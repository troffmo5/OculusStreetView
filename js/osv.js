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
var currHeading = 0;
var centerHeading = 0;
var navList = [];

var headingVector = new THREE.Vector3();
var moveVector = new THREE.Vector3();
var keyboardMoveVector = new THREE.Vector3();
var gamepadMoveVector = new THREE.Vector3();
var HMDRotation = new THREE.Quaternion();
var BaseRotation = new THREE.Quaternion();
var BaseRotationEuler = new THREE.Vector3();

var VRState = null;

// Utility function
// ----------------------------------------------
function angleRangeDeg(angle) {
  angle %= 360;
  if (angle < 0) angle += 360;
  return angle;
}

function angleRangeRad(angle) {
  angle %= 2*Math.PI;
  if (angle < 0) angle += 2*Math.PI;
  return angle;
}

function deltaAngleDeg(a,b) {
  return Math.min(360-(Math.abs(a-b)%360),Math.abs(a-b)%360);
}

function deltaAngleRas(a,b) {
  // todo
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

  // Set the window resolution of the rift in case of not native
  OculusRift.hResolution = WIDTH, OculusRift.vResolution = HEIGHT,

  effect = new THREE.OculusRiftEffect( renderer, {HMD:OculusRift, worldFactor:WORLD_FACTOR} );
  effect.setSize(WIDTH, HEIGHT );

  var viewer = $('#viewer');
  viewer.append(renderer.domElement);
}

function initControls() {

  // Keyboard
  // ---------------------------------------
  var lastSpaceKeyTime = new Date(),
      lastCtrlKeyTime = lastSpaceKeyTime;

  $(document).keydown(function(e) {
    //console.log(e.keyCode);
    switch(e.keyCode) {
      case 32: // Space
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
      case 17: // Ctrl
        var ctrlKeyTime = new Date();
        if (ctrlKeyTime-lastCtrlKeyTime < 300) {
          moveToNextPlace();
        }
        lastCtrlKeyTime = ctrlKeyTime;
        break;
      case 18: // Alt
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

  // Mouse
  // ---------------------------------------
  var viewer = $('#viewer'),
      mouseButtonDown = false,
      lastClientX = 0,
      lastClientY = 0;

  viewer.dblclick(function() {
    moveToNextPlace();
  });

  viewer.mousedown(function(event) {
    mouseButtonDown = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  viewer.mouseup(function() {
    mouseButtonDown = false;
  });

  viewer.mousemove(function(event) {
    if (mouseButtonDown) {
      var enableX = (USE_TRACKER || VRState !== null) ? 0 : 1;
      BaseRotationEuler.set(
        angleRangeRad(BaseRotationEuler.x + (event.clientY - lastClientY) * MOUSE_SPEED * enableX),
        angleRangeRad(BaseRotationEuler.y + (event.clientX - lastClientX) * MOUSE_SPEED),
        0.0
      );
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      BaseRotation.setFromEuler(BaseRotationEuler, 'YZX');
    }
  });

  // Gamepad
  // ---------------------------------------
  gamepad = new Gamepad();
  gamepad.bind(Gamepad.Event.CONNECTED, function(device) {
    console.log("Gamepad CONNECTED")
  });

  gamepad.bind(Gamepad.Event.BUTTON_DOWN, function(e) {
    if (e.control == "FACE_2") {
      $('.ui').toggle(200);
    }
  });

  // Look for tick event so that we can hold down the FACE_1 button and
  // continually move in the current direction
  gamepad.bind(Gamepad.Event.TICK, function(gamepads) {
    // Multiple calls before next place has finished loading do not matter
    // GSVPano library will ignore these
    if (gamepads[0].state["FACE_1"] === 1) {
      moveToNextPlace();
    }
  });

  gamepad.bind(Gamepad.Event.AXIS_CHANGED, function(e) {

    // ignore deadzone
    var value = e.value;
    if (value < -DEADZONE) value = value + DEADZONE;
    else if(value > DEADZONE) value = value - DEADZONE;
    else value = 0;

    if (e.axis == "LEFT_STICK_X") {
      gamepadMoveVector.y = -value*GAMEPAD_SPEED;
    }
    else if (e.axis == "LEFT_STICK_Y") {
      gamepadMoveVector.x = -value*GAMEPAD_SPEED;
    }
  });

  if (!gamepad.init()) {
    //console.log("Gamepad not supported");
  }
}

function initGui()
{
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
  });

  $('#wsock-right').change(function(event) {
    WEBSOCKET_ADDR = $('#wsock-right').val();
    if (USE_TRACKER) {
      if (connection) connection.close();
      initWebSocket();
    }
  });

  $('#wsock-left').keyup(function() {
      $('#wsock-right').prop('value', $('#wsock-left').val() );
  });

  $('#wsock-right').keyup(function() {
      $('#wsock-left').prop('value', $('#wsock-right').val() );
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
  };

  connection.onclose = function () {
    //console.log('websocket close');
    if (USE_TRACKER) setTimeout(initWebSocket, 1000);
  };
}

function initGoogleMap() {
  $('.mapprogress').progressbar({ value: false });

  currentLocation = new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng );

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

  $('#mapsearch-left').change(function() {
      geocoder.geocode( { 'address': $('#mapsearch-left').val()}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        gmapLeft.setCenter(results[0].geometry.location);
        panoLoader.load( results[0].geometry.location );
      }
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

  $('#mapsearch-left').keyup(function() {
      $('#mapsearch-right').prop('value', $('#mapsearch-left').val() );
  });

  $('#mapsearch-right').keyup(function() {
      $('#mapsearch-left').prop('value', $('#mapsearch-right').val() );
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

  // Update camera rotation
  camera.quaternion.multiplyQuaternions(BaseRotation, HMDRotation);

  // Compute heading
  headingVector.setEulerFromQuaternion(camera.quaternion, 'YZX');
  currHeading = angleRangeDeg(THREE.Math.radToDeg(-headingVector.y));

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
  initControls();
  initGui();
  initPano();
  if (USE_TRACKER) initWebSocket();
  else initVR();
  initGoogleMap();

  // Load default location
  panoLoader.load( new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng ) );

  loop();
});
