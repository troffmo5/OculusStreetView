/**
 * @author troffmo5 / http://github.com/troffmo5
 *
 * Google Street View viewer for the Oculus Rift
 */

// Parameters
// ----------------------------------------------
var QUALITY = 3;
var DEFAULT_LOCATION = { lat:44.301945982379095,  lng:9.211585521697998 };
var WEBSOCKET_ADDR = "ws://127.0.0.1:1981";
var USE_TRACKER = false;
var MOVING_MOUSE = false;
var MOUSE_SPEED = 0.005;
var KEYBOARD_SPEED = 0.02;
var GAMEPAD_SPEED = 0.04;
var DEADZONE = 0.2;
var SHOW_SETTINGS = true;
var NAV_DELTA = 45;
var FAR = 1000;
var USE_DEPTH = true;
var WORLD_FACTOR = 1.0;
var OculusRift = {
  // Parameters from the Oculus Rift DK1
  hResolution: 1280,
  vResolution: 800,
  hScreenSize: 0.14976,
  vScreenSize: 0.0936,
  interpupillaryDistance: 0.064,
  lensSeparationDistance: 0.064,
  eyeToScreenDistance: 0.041,
  distortionK : [1.0, 0.22, 0.24, 0.0],
  chromaAbParameter: [ 0.996, -0.004, 1.014, 0.0]
};

// Globals
// ----------------------------------------------
var WIDTH, HEIGHT;
var GAMEPAD;
var currHeading = 0;
var centerHeading = 0;
var mouseMoved = false;
var navList = [];

var headingVector = new THREE.Vector3();
var moveVector = new THREE.Vector3();
var keyboardMoveVector = new THREE.Vector3();
var gamepadMoveVector = new THREE.Vector3();
var HMDRotation = new THREE.Quaternion();
var BaseRotation = new THREE.Quaternion();
var BaseRotationEuler = new THREE.Vector3();

var gamepad;
var VRState = null;

// Utility function
// ----------------------------------------------
function angleRangeDeg(angle) {
  while (angle >= 360) angle -=360;
  while (angle < 0) angle +=360;
  return angle;
}

function angleRangeRad(angle) {
  while (angle > Math.PI) angle -= 2*Math.PI;
  while (angle <= -Math.PI) angle += 2*Math.PI;
  return angle;
}

function deltaAngleDeg(a,b) {
  return Math.min(360-(Math.abs(a-b)%360),Math.abs(a-b)%360);
}

function deltaAngleRas(a,b) {
  // todo
}

function updateCameraRotation() {
  camera.quaternion.multiplyQuaternions(BaseRotation, HMDRotation);
  headingVector.setEulerFromQuaternion(camera.quaternion, 'YZX');
  currHeading = angleRangeDeg(THREE.Math.radToDeg(-headingVector.y));
  //console.log('HEAD', currHeading);
}
// ----------------------------------------------

function initWebGL() {
  // create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera( 60, WIDTH/HEIGHT, 0.1, FAR );
  camera.target = new THREE.Vector3( 1, 0, 0 );
  camera.useQuaternion = true;
  scene.add( camera );

  // Add projection sphere
  projSphere = new THREE.Mesh( new THREE.SphereGeometry( 500, 512, 256 ), new THREE.MeshBasicMaterial({ map: THREE.ImageUtils.loadTexture('placeholder.png'), side: THREE.DoubleSide}) );
  projSphere.geometry.dynamic = true;
  projSphere.useQuaternion = true;
  scene.add( projSphere );

  // Add Progress Bar
  progBarContainer = new THREE.Mesh( new THREE.CubeGeometry(1.2,0.2,0.1), new THREE.MeshBasicMaterial({color: 0xaaaaaa}));
  progBarContainer.translateZ(-3);
  camera.add( progBarContainer );

  progBar = new THREE.Mesh( new THREE.CubeGeometry(1.0,0.1,0.1), new THREE.MeshBasicMaterial({color: 0x0000ff}));
  progBar.translateZ(0.2);
  progBarContainer.add(progBar);

  // Create render
  try {
    renderer = new THREE.WebGLRenderer();
  }
  catch(e){
    alert('This application needs WebGL enabled!');
    return false;
  }

  renderer.autoClearColor = false;
  renderer.setSize( WIDTH, HEIGHT );

  // Add stereo effect
  OculusRift.hResolution = WIDTH, OculusRift.vResolution = HEIGHT,

  // Add stereo effect
  effect = new THREE.OculusRiftEffect( renderer, {HMD:OculusRift, worldFactor:WORLD_FACTOR} );
  effect.setSize(WIDTH, HEIGHT );

  var viewer = $('#viewer');
  viewer.append(renderer.domElement);

  var lastSpaceKeyTime = new Date();
  var lastCtrlKeyTime = new Date();
  $(document).keydown(function(e) {
    //console.log(e.keyCode);
    switch(e.keyCode) {
      case 32:
        var spaceKeyTime = new Date();
        if (spaceKeyTime-lastSpaceKeyTime < 300) {
          $('.ui').toggle(200);
        }
        lastSpaceKeyTime = spaceKeyTime;
        break;
      case 37:
        keyboardMoveVector.y = KEYBOARD_SPEED;
        break;
      case 38:
        keyboardMoveVector.x = KEYBOARD_SPEED;
        break;
      case 39:
        keyboardMoveVector.y = -KEYBOARD_SPEED;
        break;
      case 40:
        keyboardMoveVector.x = -KEYBOARD_SPEED;
        break;
      case 17:
        var ctrlKeyTime = new Date();
        if (ctrlKeyTime-lastCtrlKeyTime < 300) {
          moveToNextPlace();
        }
        lastCtrlKeyTime = ctrlKeyTime;
        break;
      case 18: //alt
        USE_DEPTH = !USE_DEPTH;
        $('#depth-left').prop('checked', USE_DEPTH);
        $('#depth-right').prop('checked', USE_DEPTH);
        setSphereGeometry();
        break;
    }
  });

  $(document).keyup(function(e) {
    switch(e.keyCode) {
      case 37:
      case 39:
        keyboardMoveVector.y = 0.0;
        break;
      case 38:
      case 40:
        keyboardMoveVector.x = 0.0;
        break;
    }
  });

  viewer.dblclick(function() {
    moveToNextPlace();
  });

  viewer.mousedown(function(event) {
    MOVING_MOUSE = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  viewer.mouseup(function() {
    MOVING_MOUSE = false;
  });

  lastClientX = 0; lastClientY = 0;
  viewer.mousemove(function(event) {
    if (MOVING_MOUSE) {
      var enableX = (USE_TRACKER || VRState !== null) ? 0 : 1;
      BaseRotationEuler.set(
        angleRangeRad(BaseRotationEuler.x + (event.clientY - lastClientY) * MOUSE_SPEED * enableX),
        angleRangeRad(BaseRotationEuler.y + (event.clientX - lastClientX) * MOUSE_SPEED),
        0.0
      );
      lastClientX = event.clientX;lastClientY =event.clientY;
      BaseRotation.setFromEuler(BaseRotationEuler, 'YZX');

      updateCameraRotation();
    }
  });

  if (!SHOW_SETTINGS) {
    $('.ui').hide();
  }

  $('#extt-left').prop('checked', USE_TRACKER);
  $('#extt-right').prop('checked', USE_TRACKER);


  $('#extt-left').change(function(event) {
    USE_TRACKER = $('#extt-left').is(':checked');
    if (USE_TRACKER) {
      WEBSOCKET_ADDR = $('#wsock-left').val();
      initWebSocket();
      BaseRotationEuler.x = 0.0;
      VRState = null;
    }
    else {
      if (connection) connection.close();
      initVR();
    }
    $('#extt-right').prop('checked', USE_TRACKER);
  });

  $('#extt-right').change(function(event) {
    USE_TRACKER = $('#extt-right').is(':checked');
    if (USE_TRACKER) {
      WEBSOCKET_ADDR = $('#wsock-right').val();
      initWebSocket();
      BaseRotationEuler.x = 0.0;
      VRState = null;
    }
    else {
      if (connection) connection.close();
      initVR();
    }
    $('#extt-left').prop('checked', USE_TRACKER);
  });

  $('#wsock-left').change(function(event) {
    WEBSOCKET_ADDR = $('#wsock-left').val();
    if (USE_TRACKER) {
      if (connection) connection.close();
      initWebSocket();
    }
    $('#wsock-right').prop('value', $('#wsock-left').val());
  });

  $('#wsock-right').change(function(event) {
    WEBSOCKET_ADDR = $('#wsock-right').val();
    if (USE_TRACKER) {
      if (connection) connection.close();
      initWebSocket();
    }
    $('#wsock-left').prop('value', $('#wsock-right').val());
  });

  $('#depth-left').change(function(event) {
    USE_DEPTH = $('#depth-left').is(':checked');
    $('#depth-right').prop('checked', USE_DEPTH);
    setSphereGeometry();
  });

  $('#depth-right').change(function(event) {
    USE_DEPTH = $('#depth-right').is(':checked');
    $('#depth-left').prop('checked', USE_DEPTH);
    setSphereGeometry();
  });

  window.addEventListener( 'resize', resize, false );

}

function initPano() {
  panoLoader = new GSVPANO.PanoLoader();
  panoDepthLoader = new GSVPANO.PanoDepthLoader();
  panoLoader.setZoom(QUALITY);

  panoLoader.onProgress = function( progress ) {
    if (progress > 0) {
      progBar.visible = true;
      progBar.scale = new THREE.Vector3(progress/100.0,1,1);
    }
    $(".mapprogress").progressbar("option", "value", progress);

  };
  panoLoader.onPanoramaData = function( result ) {
    progBarContainer.visible = true;
    progBar.visible = false;
    $('.mapprogress').show();
  };

  panoLoader.onNoPanoramaData = function( status ) {
    //alert('no data!');
  };

  panoLoader.onPanoramaLoad = function() {
    var a = THREE.Math.degToRad(90-panoLoader.heading);
    projSphere.quaternion.setFromEuler(new THREE.Vector3(0,a,0), 'YZX');

    projSphere.material.wireframe = false;
    projSphere.material.map.needsUpdate = true;
    projSphere.material.map = new THREE.Texture( this.canvas );
    projSphere.material.map.needsUpdate = true;
    centerHeading = panoLoader.heading;

    progBarContainer.visible = false;
    progBar.visible = false;

    markerLeft.setMap( null );
    markerLeft = new google.maps.Marker({ position: this.location.latLng, map: gmapLeft });
    markerLeft.setMap( gmapLeft );

    markerRight.setMap( null );
    markerRight = new google.maps.Marker({ position: this.location.latLng, map: gmapRight });
    markerRight.setMap( gmapRight );

    $('.mapprogress').hide();

    if (window.history) {
      var newUrl = '/?lat='+this.location.latLng.lat()+'&lng='+this.location.latLng.lng();
      newUrl += USE_TRACKER ? '&sock='+escape(WEBSOCKET_ADDR.slice(5)) : '';
      newUrl += '&q='+QUALITY;
      newUrl += '&s='+$('#settings').is(':visible');
      newUrl += '&heading='+currHeading;
      window.history.pushState('','',newUrl);
    }

    panoDepthLoader.load(this.location.pano);
  };

  panoDepthLoader.onDepthLoad = function() {
    setSphereGeometry();
  };
}

function setSphereGeometry() {
  var geom = projSphere.geometry;
  var depthMap = panoDepthLoader.depthMap.depthMap;
  var y, x, u, v, radius, i=0;
  for ( y = 0; y <= geom.heightSegments; y ++ ) {
    for ( x = 0; x <= geom.widthSegments; x ++ ) {
      u = x / geom.widthSegments;
      v = y / geom.heightSegments;

      radius = USE_DEPTH ? Math.min(depthMap[y*512 + x], FAR) : 500;

      var vertex = geom.vertices[i];
      vertex.x = - radius * Math.cos( geom.phiStart + u * geom.phiLength ) * Math.sin( geom.thetaStart + v * geom.thetaLength );
      vertex.y = radius * Math.cos( geom.thetaStart + v * geom.thetaLength );
      vertex.z = radius * Math.sin( geom.phiStart + u * geom.phiLength ) * Math.sin( geom.thetaStart + v * geom.thetaLength );
      i++;
    }
  }
  geom.verticesNeedUpdate = true;
}

function initWebSocket() {
  connection = new WebSocket(WEBSOCKET_ADDR);
  //console.log('WebSocket conn:', connection);

  connection.onopen = function () {
    // connection is opened and ready to use
    //console.log('websocket open');
  };

  connection.onerror = function (error) {
    // an error occurred when sending/receiving data
    //console.log('websocket error :-(');
    if (USE_TRACKER) setTimeout(initWebSocket, 1000);
  };

  connection.onmessage = function (message) {
    var data = JSON.parse('['+message.data+']');
    HMDRotation.set(data[1],data[2],data[3],data[0]);
    updateCameraRotation();
  };

  connection.onclose = function () {
    //console.log('websocket close');
    if (USE_TRACKER) setTimeout(initWebSocket, 1000);
  };
}

var lastButton0 = 0;
var lastButton1 = 0;
function getGamepadEvents() {
  var gamepadSupportAvailable = !!navigator.webkitGetGamepads || !!navigator.webkitGamepads;
  if (gamepadSupportAvailable) {
    var gamepads = navigator.webkitGetGamepads();
    for (var i = 0; i < gamepads.length; ++i)
    {
        var pad = gamepads[i];
        if (pad) {
          //console.log(pad.buttons, pad.axes);
          if (pad.buttons[0] === 1 && lastButton0 === 0) {
            moveToNextPlace();
          }
          lastButton0 = pad.buttons[0];

          var padX = pad.axes[1], padY = pad.axes[0];

          // ignore deadzone
          if (padX < -DEADZONE)
            padX = padX + DEADZONE;
          else if(padX > DEADZONE)
            padX = padX - DEADZONE;
          else
            padX = 0;

          if (padY < -DEADZONE)
            padY = padY + DEADZONE;
          else if(padY > DEADZONE)
            padY = padY - DEADZONE;
          else
            padY = padY = 0;

          gamepadMoveVector.set(-padX*GAMEPAD_SPEED, -padY*GAMEPAD_SPEED, 0.0);
        }
    }
  }
}

function initGoogleMap() {

  $('.mapprogress').progressbar({
    value: false
  });

  currentLocation = new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng );

  var eventLock = false;
  gmapLeft = new google.maps.Map($('#map-left')[0], {
    zoom: 14,
    center: currentLocation,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false
  });
  google.maps.event.addListener(gmapLeft, 'click', function(event) {
    panoLoader.load(event.latLng);
  });

  google.maps.event.addListener(gmapLeft, 'center_changed', function(event) {
    if(!this.blockEvents) {
      gmapRight.blockEvents = true;
      gmapRight.setCenter(gmapLeft.getCenter());
      gmapRight.blockEvents = false;
    }
  });
  google.maps.event.addListener(gmapLeft, 'zoom_changed', function(event) {
    if(!this.blockEvents) {
      gmapRight.blockEvents = true;
      gmapRight.setZoom(gmapLeft.getZoom());
      gmapRight.blockEvents = false;
    }
  });
  google.maps.event.addListener(gmapLeft, 'maptypeid_changed', function(event) {
    if(!this.blockEvents) {
      gmapRight.blockEvents = true;
      gmapRight.setMapTypeId(gmapLeft.getMapTypeId());
      gmapRight.blockEvents = false;
    }
  });
  gmapLeft.blockEvents = false;

  gmapRight = new google.maps.Map($('#map-right')[0], {
    zoom: 14,
    center: currentLocation,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    streetViewControl: false
  });

  google.maps.event.addListener(gmapRight, 'click', function(event) {
    panoLoader.load(event.latLng);
  });

  google.maps.event.addListener(gmapRight, 'center_changed', function(event) {
    if (!this.blockEvents) {
      gmapLeft.blockEvents = true;
      gmapLeft.setCenter(gmapRight.getCenter());
      gmapLeft.blockEvents = false;

    }
  });
  google.maps.event.addListener(gmapRight, 'zoom_changed', function(event) {
    if (!this.blockEvents) {
      gmapLeft.blockEvents = true;
      gmapLeft.setZoom(gmapRight.getZoom());
      gmapLeft.blockEvents = false;
    }
  });
  google.maps.event.addListener(gmapRight, 'maptypeid_changed', function(event) {
    if (!this.blockEvents) {
      gmapLeft.blockEvents = true;
      gmapLeft.setMapTypeId(gmapRight.getMapTypeId());
      gmapLeft.blockEvents = false;
    }
  });
  gmapRight.blockEvents = false;

  svCoverageLeft = new google.maps.StreetViewCoverageLayer();
  svCoverageLeft.setMap(gmapLeft);

  svCoverageRight = new google.maps.StreetViewCoverageLayer();
  svCoverageRight.setMap(gmapRight);

  geocoder = new google.maps.Geocoder();

  // TODO: better sync
  $('#mapsearch-left').change(function() {
      geocoder.geocode( { 'address': $('#mapsearch-left').val()}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        gmapLeft.setCenter(results[0].geometry.location);
        panoLoader.load( results[0].geometry.location );
      }
      $('#mapsearch-right').prop('value', $('#mapsearch-left').val() );
    });
  });
  $('#mapsearch-right').change(function() {
      geocoder.geocode( { 'address': $('#mapsearch-right').val()}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        gmapLeft.setCenter(results[0].geometry.location);
        panoLoader.load( results[0].geometry.location );
      }
      $('#mapsearch-left').prop('value', $('#mapsearch-right').val() );
    });
  });



  markerLeft = new google.maps.Marker({ position: currentLocation, map: gmapLeft });
  markerLeft.setMap( gmapLeft );

  markerRight = new google.maps.Marker({ position: currentLocation, map: gmapRight });
  markerRight.setMap( gmapRight );

}


function moveToNextPlace() {
  var nextPoint = null;
  var minDelta = 360;
  var navList = panoLoader.links;
  for (var i = 0; i < navList.length; i++) {
    var delta = deltaAngleDeg(currHeading, navList[i].heading);
    if (delta < minDelta && delta < NAV_DELTA) {
      minDelta = delta;
      nextPoint = navList[i].pano;
    }
  }

  if (nextPoint) {
    panoLoader.load(nextPoint);
  }
}

function initVR() {
  vr.load(function(error) {
    if (error) {
      //console.warn('VR error: ' + error.toString());
      return;
    }

    VRState = new vr.State();
    if (!vr.pollState(VRState)) {
      //console.warn('NPVR plugin not found/error polling');
      VRState = null;
      return;
    }

    if (!VRState.hmd.present) {
      //console.warn('oculus rift not detected');
      VRState = null;
      return;
    }
    BaseRotationEuler.x = 0.0;
  });
}

function render() {
  effect.render( scene, camera );
  //renderer.render(scene, camera);
}

function setUiSize() {
  var width = window.innerWidth, hwidth = width/2,
      height = window.innerHeight;

  var ui = $('#ui-left');
  var hsize=0.60, vsize = 0.40, outOffset=0.2;
  ui.css('width', hwidth*hsize);
  ui.css('left', hwidth*(1-hsize+outOffset)/2) ;
  ui.css('height', height*vsize);
  ui.css('margin-top', height*(1-vsize)/2);

  ui = $('#ui-right');
  hsize=0.60; vsize = 0.40; outOffset=0.1;
  ui.css('width', hwidth*hsize);
  ui.css('right', hwidth*(1-hsize+outOffset)/2) ;
  ui.css('height', height*vsize);
  ui.css('margin-top', height*(1-vsize)/2);

}


function resize( event ) {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  setUiSize();

  OculusRift.hResolution = WIDTH,
  OculusRift.vResolution = HEIGHT,
  effect.setHMD(OculusRift);

  renderer.setSize( WIDTH, HEIGHT );
  camera.projectionMatrix.makePerspective( 60, WIDTH /HEIGHT, 1, 1100 );
}

function loop() {
  requestAnimationFrame( loop );

  // Check gamepad movement
  getGamepadEvents();

  // User vr plugin
  if (!USE_TRACKER && VRState !== null) {
    if (vr.pollState(VRState)) {
      HMDRotation.set(VRState.hmd.rotation[0], VRState.hmd.rotation[1], VRState.hmd.rotation[2], VRState.hmd.rotation[3]);
    }
  }

  // Compute move vector
  moveVector.addVectors(keyboardMoveVector, gamepadMoveVector);

  // Disable X movement HMD tracking is enabled
  if (USE_TRACKER || VRState !== null) {
    moveVector.x = 0;
  }

  // Apply movement
  BaseRotationEuler.set( angleRangeRad(BaseRotationEuler.x + moveVector.x), angleRangeRad(BaseRotationEuler.y + moveVector.y), 0.0 );
  BaseRotation.setFromEuler(BaseRotationEuler, 'YZX');
  updateCameraRotation();

  // render
  render();
}

function getParams() {
  var params = {};
  var items = window.location.search.substring(1).split("&");
  for (var i=0;i<items.length;i++) {
    var kvpair = items[i].split("=");
    params[kvpair[0]] = unescape(kvpair[1]);
  }
  return params;
}

$(document).ready(function() {

  // Read parameters
  params = getParams();
  if (params.lat !== undefined) DEFAULT_LOCATION.lat = params.lat;
  if (params.lng !== undefined) DEFAULT_LOCATION.lng = params.lng;
  if (params.sock !== undefined) {WEBSOCKET_ADDR = 'ws://'+params.sock; USE_TRACKER = true;}
  if (params.q !== undefined) QUALITY = params.q;
  if (params.s !== undefined) SHOW_SETTINGS = params.s !== "false";
  if (params.heading !== undefined) {
    BaseRotationEuler.set(0.0, angleRangeRad(THREE.Math.degToRad(-parseFloat(params.heading))) , 0.0 );
    BaseRotation.setFromEuler(BaseRotationEuler, 'YZX');
  }
  if (params.depth !== undefined) USE_DEPTH = params.depth !== "false";
  if (params.wf !== undefined) WORLD_FACTOR = parseFloat(params.wf);


  WIDTH = window.innerWidth; HEIGHT = window.innerHeight;
  $('.ui').tabs({
    activate: function( event, ui ) {
      var caller = event.target.id;
      if (caller == 'ui-left') {
        $("#ui-right").tabs("option","active", $("#ui-left").tabs("option","active"));
      }
      if (caller == 'ui-right') {
        $("#ui-left").tabs("option","active", $("#ui-right").tabs("option","active"));
      }
    }
  });
  setUiSize();

  initWebGL();
  initPano();
  if (USE_TRACKER) initWebSocket();
  else initVR();
  initGoogleMap();

  // Load default location
  panoLoader.load( new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng ) );

  loop();
});
