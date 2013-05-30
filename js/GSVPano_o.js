/*
GSVPano.js - Google Street View Panorama lib
http://www.clicktorelease.com/code/street/ 

License

MIT licensed

Copyright (C) 2012 Jaume Sanchez Elias, http://www.clicktorelease.com

Modified version by troffmo5 (lsiciliano@web.de)
*/
var GSVPANO = GSVPANO || {};
GSVPANO.PanoLoader = function (parameters) {

	'use strict';

	var _parameters = parameters || {},
		_location,
		_zoom,
		_panoId,
		_panoClient = new google.maps.StreetViewService(),
		_count = 0,
		_total = 0,
		_canvas = document.createElement('canvas'),
		_ctx = _canvas.getContext('2d'),
		rotation = 0,
		copyright = '',
		links = [],
		loading = false,
		onSizeChange = null,
		onPanoramaLoad = null;

	this.setProgress = function (p) {
		if (this.onProgress) {
			this.onProgress(p);
		}
	};

	this.throwError = function (message) {
		if (this.onError) {
			this.onError(message);
		} else {
			console.error(message);
		}
	};

	this.adaptTextureToZoom = function () {
		var w = 416 * Math.pow(2, _zoom),
		h = (416 * Math.pow(2, _zoom - 1));
		_canvas.width = w;
		_canvas.height = h;
		_ctx.translate( _canvas.width, 0);
		_ctx.scale(-1, 1);
	};

	this.composeFromTile = function (x, y, texture) {

		_ctx.drawImage(texture, x * 512, y * 512);
		_count++;

		var p = Math.round(_count * 100 / _total);
		this.setProgress(p);

		if (_count === _total) {
			this.canvas = _canvas;
			this.loading = false;
			if (this.onPanoramaLoad) {
				this.onPanoramaLoad();
			}
		}

	};

	this.composePanorama = function (cache) {
		this.setProgress(0);

		var w = Math.pow(2, _zoom ),
			h = Math.pow(2, _zoom - 1),
			self = this,
			url,
			x, y;
		if (_zoom == 3) w-=1;
		if (_zoom == 4) { w -= 3; h-=1;}

		_count = 0;
		_total = w * h;

		for( y = 0; y < h; y++) {
			for( x = 0; x < w; x++) {
				url = 'http://maps.google.com/cbk?output=tile&panoid=' + _panoId + '&zoom=' + _zoom + '&x=' + x + '&y=' + y;
				if (!cache) url += '&' + Date.now();
				(function (x, y) {
					var img = new Image();
					img.addEventListener('load', function () {
						self.composeFromTile(x, y, this);
					});
					img.crossOrigin = '';
					img.src = url;
				})(x, y);
			}
		}
	};

	this.loadCB = function (result, status, location, cache) {
		var self = this;
		if (status === google.maps.StreetViewStatus.OK) {
			if( self.onPanoramaData ) self.onPanoramaData( result );
			var h = google.maps.geometry.spherical.computeHeading(location, result.location.latLng);

			rotation = (result.tiles.centerHeading - h) * Math.PI / 180.0;
			copyright = result.copyright;
			self.copyright = result.copyright;
			self.links = result.links;
			self.heading = result.tiles.centerHeading;
			_panoId = result.location.pano;
			self.location = result.location;
			self.composePanorama(cache);
		} else {
			if( self.onNoPanoramaData ) self.onNoPanoramaData( status );
			self.loading = false;
			self.throwError('Could not retrieve panorama for the following reason: ' + status);
		}
	},

	this.load = function (location, cache) {
		var self = this;
		if (self.loading) return;
		self.loading = true;
		cache = cache || true;
		if ((typeof location) === 'string') {
			_panoClient.getPanoramaById(location, function(result, status){self.loadCB(result, status, location, cache)})
		}
		else {
			_panoClient.getPanoramaByLocation(location, 50,  function(result, status){self.loadCB(result, status, location, cache);})
		}
	};

	this.setZoom = function( z ) {
		_zoom = z;
		this.adaptTextureToZoom();
	};

	this.setZoom( _parameters.zoom || 1 );

};