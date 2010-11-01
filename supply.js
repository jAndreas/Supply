// ----------------------------------------------------------------------------
// supply.js
// version: 1.0.5
// ----------------------------------------------------------------------------
// Author: Andreas Goebel
// Date: 2010-11-01
// ----------------------------------------------------------------------------
// Supply uses mxhr (multipart xhr) to transfer javascript & stylesheet files
// asynchronously from a server to the browser. 
// ----------------------------------------------------------------------------
// Public methods:
// ----------------------------------------------------------------------------
// files: function(object)
// supply.files({
//		javascript: [
//			'foo.js',
//			'bar.js'
//		],
//		stylesheet: [
//			'sheet.css'
//		],
//		callback: function(){
//		}
// });
// ----------------------------------------------------------------------------
// listen: function(mime, callback)
// supply.listen('text/javascript', function(payload, filename){
//    eval(payload);
// });

window.supply = (function(window, document, undefined){
	var version					= '1.0.5',								// current version
		dealer					= '/cgi-bin/supply.pl',					// server script which deals us data
		xhr						= null,									// XmlHttpRequest object
		getLatestPacketInterval = null,									// timer Id
		lastLength				= 0,									// last known length from field delimiter
		boundary				= '\u0003',								// control character (delimiter within a line) 
		fieldDelimiter			= '\u0001',								// control character (delimiter for lines)
		self					= {},									// returned (public) object
		my						= {},									// private data
		listeners				= {},									// mime event listeners
		ua						= navigator.userAgent.toLowerCase(),	// user agent string
		toStr					= Object.prototype.toString, 			// shorthand method
		_msxml_progid 			= [										// possible ActiveX XHR strings
									'Microsoft.XMLHTTP', 				// no readystate === 3 support
									'MSXML2.XMLHTTP.3.0', 				// no readystate === 3 support
									'MSXML3.XMLHTTP',				
									'MSXML2.XMLHTTP.6.0'
								  ],
		options					= {
			loadjavascript:		1,			// does supply require javascript files ?
			loadstylesheet:		2,			// does supply require stylesheet files ?
			jsonavailable:		4,			// is JSON (parse & stringify methods) available ?   > DEPRECATED
			callback:			8,			// was a callback method passed in ?
			useeval:			16,			// shall Supply use eval() or script tag insertion ?
			msie:				32,			// is the UA an internet explorer ?
			compatibleIE:		64,			// do we have a XDomainRequest ?
			debug:				128			// debug mode ?
		},
		settings				= 0;
			
	my.reset = function(){
		getLatestPacketInterval	= null;
		lastLength				= null;
		settings			   	= 0;
		
		if(xhr) xhr.abort();
		
		// use eval to load javascript files
		settings |= options.useeval;
		// very simple check if we are in an internet explorer environment, to prevent accessing responseText on xhr readyState===3
		settings |= /msie/.test(ua) ? options.msie : 0;	
		if (settings & options.msie && ua.match(/msie\D+(\d+(\.\d+)?)/) )
			if(parseFloat(RegExp.$1) >= 8 && 'XDomainRequest' in window)
				settings |= options.compatibleIE;
	    
	    // reset the 'complete' listener
	    if('complete' in listeners)
	    	listeners['complete'] = [];
	};
	
	// create self.init() (self invoking) which initializes a new XMLHttpRequest object				
	my.init = (function(){																
		// try to create a XMLHttpRequest object. First try to use a standard call to "new XMLHttpRequest()", if that fails
		// fallback to "new ActiveXObject()". Loop through _msxml_progid array with possible strings.
		// Exception: if we have option compatibleIE set (most likely IE8), we can use the XDomainRequest object to get streaming data (2048bytes preload needed)
		my.reset();

		xhr = (function() {
			var req;
			try {		
				if(settings & options.compatibleIE)
					req = new XDomainRequest();
				else
					req = new XMLHttpRequest();				
			} catch(e){				
				var len = _msxml_progid.length;
				while(len--){
					try{						
						req = new ActiveXObject(_msxml_progid[len]);
						break;
					} catch(e2){ }
				}
			} finally { return req; }
		}());
		
		// if we couldn't create a XMLHttpRequest, throw an error and abort.
		if(!xhr){
			throw new Error('Unable to create XMLHttpRequest');
		}		
	}());

	// files() takes an object as argument. That object should contain a "javascript" and a "stylesheet" property,
	// both referencing an array with filenames. That names get JSON.stringified** and are transfered to the backend script.   ** [json will get replaced through a standard query string]
	self.files = function(args){
		var _jsfiles 	= args.javascript,
			_cssfiles	= args.stylesheet,
			_callback	= args.callback,
			_debug		= args.debug,			
			params		= [],
			query		= '';
			
		my.reset();
			
		if(_jsfiles && toStr.call(_jsfiles) === "[object Array]")
			settings |= options.loadjavascript;
		if(_cssfiles && toStr.call(_cssfiles) === "[object Array]")
			settings |= options.loadstylesheet;
		if(_debug && _debug === true)
			settings |= options.debug;
		if(_callback && (typeof _callback === 'function' || typeof _callback === 'string'))
			settings |= options.callback;			
			
		if(settings & options.loadjavascript)
			params.push(my.serialize(_jsfiles, 'js'));
		if(settings & options.loadstylesheet)
			params.push(my.serialize(_cssfiles, 'css'));
		if(settings & options.callback){
			if(typeof _callback === 'function'){
				self.listen('complete', _callback); 
			}
			else if(typeof _callback === 'string'){
				if(_callback in window)
					self.listen('complete', window[_callback]);
			}
		}
		
		if(!_debug){
			query = dealer + '?' + params.join('&');
			
			if(settings & options.compatibleIE){
				xhr.onprogress = function(){
					my.readyStateHandler(true);
				};
				xhr.onload = function(){
					my.readyStateHandler(true, true);
				};
			}
			else{
				xhr.onreadystatechange = function(){
					my.readyStateHandler(false);
				};				
			}					
				
			// Try to use a GET request, but if we come close to the query string limitation (Internet Explorer
			// 2083 characters), switch over to POST to be save
			if(query.length < 2048){			
				xhr.open('GET', query, true);			
				xhr.send(null);
			}
			else{					
				xhr.open('POST', dealer, true);			
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');			
				xhr.send(params.join('&'));
			}
		}
		else{ // debug mode
			my.attachScript(_jsfiles);			
		}
	};
		
	// readStateHandler() handles XHR readystate 3+4. On 3 we initialize a timer which polls data from the
	// current XHR stream. When we reach 4(=complete), we call getLatestPacket(see below) a last time to get the last data
	my.readyStateHandler = function(IE, IEload){
		if(!(settings & options.msie) || (settings & options.compatibleIE)){
			if((IE && getLatestPacketInterval === null) || (xhr.readyState === 3 && getLatestPacketInterval === null)){
				// start polling							
				getLatestPacketInterval = window.setInterval(function(){										
					my.getLatestPacket();
				}, 25);						
			}
		}
			
		if(xhr.readyState === 4 || IEload){								
			clearInterval(getLatestPacketInterval);
			my.getLatestPacket();
			
			if(listeners.complete && listeners.complete.length){
				for (var n=0, len=listeners.complete.length; n < len; n++){
					listeners.complete[n].apply(window);
				}
			}
		}
	};
		
	// getLatestPacket receives the latest stream data from xhr.responseText
	// The "new" chunk of data(packet) is passed through processPacket(see below)
	my.getLatestPacket = function(){			
		var length	= xhr.responseText.length,
			packet	= xhr.responseText.substring(lastLength, length);			
					
		my.processPacket(packet);
		lastLength	= length;	
	};

	// processPacket(): This is where the magic happens. We do some string manipulation to pull out the
	// data of interest. We invoke self.currentStream by writting the current data into it.
	my.processPacket = function(packet){
		if(packet.length < 1) return;
		
		var startPos 	= packet.indexOf(boundary),
			endPos		= -1;
			
		if(startPos > -1){
			if(my.currentStream){
				endPos		= startPos;
				startPos	= -1;
			}
			else{
				endPos		= packet.indexOf(boundary, startPos + boundary.length);
			}
		}
		
		if(!my.currentStream){
			my.currentStream = '';
			
			if(startPos > -1){
				if(endPos > -1){
					var payload			= packet.substring(startPos, endPos);
					my.currentStream	= my.currentStream + payload;
					
					packet				= packet.slice(endPos);
					my.processPayload();
					
					//try {
						my.processPacket(packet);
					//} catch(e) { console && console.log('Supply Error: ', e); }
				}
				else{
					my.currentStream	+= packet.substr(startPos);
				}
			}
		}
		else{
			if(endPos > -1){
				var chunk			= packet.substring(0, endPos);
				my.currentStream	+= chunk;
				
				packet 				= packet.slice(endPos);
				my.processPayload();
				
				my.processPacket(packet);
			}
			else{
				my.currentStream += packet;
			}
		}
	};
	
	// processPayload() splits the current stream into it's mime type & raw data.
	// It executes all event listeners that are attached to that mime-type
	my.processPayload = function(){
		my.currentStream	= my.currentStream.replace(boundary, '');
		
		var pieces		= my.currentStream.split(fieldDelimiter),
			mime		= pieces[0],
			filename	= pieces[1],			
			payload		= pieces[2];
				
		if (typeof listeners[mime] !== 'undefined') {
			for (var n = 0, len = listeners[mime].length; n < len; n++) {										
				listeners[mime][n].call(my, payload, filename);
			}
		}

		delete my.currentStream;
	};
	
	my.attachScript = function(container){
		var scr			= document.createElement('script'),
			head		= document.getElementsByTagName('head')[0],
			isArr		= toStr.call(container) === '[object Array]',
			path		= isArr ? container.shift() : container;
					
		if(!path){
			if(listeners.complete && listeners.complete.length){
				for (var n=0, len=listeners.complete.length; n < len; n++){
					listeners.complete[n].apply(window);
				}
			}
			
			return;
		}		
								
		scr.src		= path;
		scr.type	= 'text/javascript';

		scr.onload = scr.onreadystatechange = function(){
			if(scr.readyState){
				if(scr.readyState === 'complete' || scr.readyState === 'loaded'){
					scr.onreadystatechange = null;													
					isArr && my.attachScript(container);
				}
			} 
			else{ 								
				window.console && console.log(scr.src, ' attached');
				isArr && my.attachScript(container);			
			}
		};	
		
		head.insertBefore(scr, head.firstChild);
	};
	
	// serialize expects an array and a name to encode a query string
	my.serialize = function(arr, n) {
		var ret = [],
			len	= arr.length,
			i;
	
		if( toStr.call(arr) === '[object Array]' && typeof n === 'string') {
			for(i = 0; i < len; i++) {
				ret.push([n, '=', arr[i]].join(''));
			}
			
			return ret.length ? ret.join('&') : undefined;
		}
		
		return undefined;
	};
	
	// listen() attaches an array of callback functions(event listeners) into listeners object.
	self.listen = function(mime, cb){
		if(typeof listeners[mime] === 'undefined'){
			listeners[mime] = [];
		}
		
		if(typeof cb === 'function'){
			listeners[mime].push(cb);
		}
	};	

	// ---------------------------------------------------------------------------------------
	// add event listeners for text/javascript & text/css mime types
	(function(){
		self.listen('text/javascript', function(payload, filename){
			//try{
				if(settings & options.useeval){			
					eval(payload);
				}
				else{
					var head				= document.getElementsByTagName('head')[0],
						nscr				= document.createElement('script');
										
						nscr.type			= 'text/javascript';
						nscr.innerHTML		= payload;
						
					head.insertBefore(nscr, head.firstChild);	 
				}
			//}catch(err){
			//	if('console' in window) console.error(filename, ': Exception. Details -> ', err);													
			//}								
		});
		
		self.listen('text/css', function(payload){			
			var head				= document.getElementsByTagName('head')[0],
				nstyle				= document.createElement('style');
								
				nstyle.type			= 'text/css';
				nstyle.innerHTML	= payload;
				
			head.insertBefore(nstyle, head.firstChild);			
		});
	}());

	return(self);

}(window, window.document));