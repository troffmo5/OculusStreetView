OculusStreetView
================

Google Street View viewer for the Oculus Rift

Demo
-------------
http://oculusstreetview.eu.pn/index.html

Usage
-------------
- Use the mini-map to select the location.
- Double press the spacebar to toggle mini-map and settings

Navigation
-------------
- **Keyboard**: Arrows keys to look around and double-press ctrl to enter a new location
- **Mouse**: Click and drag to look around and left double-click to enter a new location
- **Gamepad**: (Chrome only) Analog stick to look around and button 0 to enter a new location

URL Parameters
-------------
index.html accepts the following parameters

- *lat*, *lng* : latitude and longitude (e.g lat=-23.442896&lng=151.906584)
- *sock* : websocket address and activate it (e.g. sock=127.0.0.1%3A1981)
- *q* : image quality (1: worst, 4:best)
- *s* : show mini-map and settings (true or false)

Example:  
http://oculusstreetview.eu.pn/index.html?lat=-23.442896&lng=151.906584&q=4&s=false&sock=127.0.0.1%3A1981

Head tracking
-------------
Head rotation must be sent over a websocket.

Here can be found a websocket server written in C# running under windows.  
https://developer.oculusvr.com/forums/viewtopic.php?f=42&t=413


Licence
-------------
MIT Licence