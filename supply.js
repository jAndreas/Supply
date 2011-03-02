// ----------------------------------------------------------------------------
// supply.js
// version: 1.0.5
// ----------------------------------------------------------------------------
// Author: Andreas Goebel
// Date: 2011-02-07
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

window.supply = ( function(window, document, undefined) {
    var version					= '1.1.2',				// current version
	    dealer					= '/exec/supply.pl',	// server script which deals us the data
	    xhr						= null,					// XmlHttpRequest object
	    getLatestPacketInterval = null,					// timer Id
	    lastLength				= 0,					// last known length from field delimiter
	    preCached				= {},					// localStorage read/write operations buffer object
	    boundary				= '\u0003',				// control character (delimiter within a line)
	    fieldDelimiter			= '\u0001',				// control character (delimiter for lines)
	    self					= {},					// returned (public) object
	    my						= {},					// private data
	    listeners				= {},					// mime event listeners
	    ua						= navigator.userAgent.toLowerCase(),	// user agent string
	    toStr					= Object.prototype.toString,			// shorthand method
	    rootElem				= document.documentElement,				// root node (required for support check)
	    myID					= 'scr' + (+new Date()),
	    fillMethod				= null,					// this is going to be 'text' or 'textContents'
	    scriptElem				= document.createElement('script'),		// script element (required for support check)
	    _msxml_progid 			= [						// possible ActiveX XHR strings
	    'Microsoft.XMLHTTP', 				// no readystate === 3 support
	    'MSXML2.XMLHTTP.3.0', 				// no readystate === 3 support
	    'MSXML3.XMLHTTP',
	    'MSXML2.XMLHTTP.6.0'
	    ],
	    options					= {
	        loadjavascript:		1,			// do we need to supply javascript files ?
	        loadstylesheet:		2,			// do we need to supply stylesheet files ?
	        jsonavailable:		4,			// is JSON (parse & stringify methods) available ?   > DEPRECATED
	        callback:			8,			// was a callback method passed in ?
	        useeval:			16,			// shall Supply use eval() or dynamic script tag insertion ?
	        msie:				32,			// is the UA an Internet Explorer ?
	        compatibleIE:		64,			// do we have a XDomainRequest object available ?
	        debug:				128,		// debug mode ?
	        removescripts:		256,		// remove scripts after inserting them ?
	        localStorage:		512,		// localStorage available ?
	        loadimages:			1024,		// do we need to supply image files ?
	        useStorage:			2048		// if localStorage is available, shall we use it ?
	    },
	    settings				= 0;

    my.reset = function() {
        getLatestPacketInterval	= null;
        lastLength				= null;
        cacheDelay				= 1500;
        settings			   	= 0;

        if(xhr)
            xhr.abort();

        // use eval to load javascript files
        settings |= options.useeval;
     // settings |= options.useStorage;
        // very simple check if we are in an internet explorer environment, to prevent accessing responseText on xhr readyState===3
        settings |= /msie/.test(ua) ? options.msie : 0;
        if (settings & options.msie && ua.match(/msie\D+(\d+(\.\d+)?)/) )
            if(parseFloat(RegExp.$1) >= 8 && 'XDomainRequest' in window)
                settings |= options.compatibleIE;

        // update the settings if the localStorage object is available
        settings |= ( function() {
            if( 'localStorage' in window ) {
                try {
                    localStorage.setItem('supply', 'test');
                    if( localStorage.getItem('supply') === 'test' ) {
                        localStorage.removeItem('supply');
                        
                        return (settings & options.useStorage) ? options.localStorage : 0;
                    }
                } catch( e ) { }
            }

            return 0;
        }());
        // reset the 'complete' listener
        if('complete' in listeners)
            listeners['complete'] = [];
    };
    // create self.init() (self invoking) which initializes a new XMLHttpRequest object
    my.init = ( function() {
        // try to create a XMLHttpRequest object. First try to use a standard call to "new XMLHttpRequest()", if that fails
        // fallback to "new ActiveXObject()". Loop through _msxml_progid array with possible strings.
        // Exception: if we have option compatibleIE set (most likely IE8), we can use the XDomainRequest object to get streaming data (2048bytes preload needed)
        my.reset();

        xhr = ( function() {
            var req;
            try {
                if( settings & options.compatibleIE )
                    req = new XDomainRequest();
                else
                    req = new XMLHttpRequest();
            } catch( e ) {
                var len = _msxml_progid.length;
                while( len-- ) {
                    try {
                        req = new ActiveXObject(_msxml_progid[len]);
                        break;
                    } catch(e2) { }
                }
            } finally {
                return req;
            }
        }());
        // if we couldn't create a XMLHttpRequest, throw an error and abort.
        if(!xhr ) {
            throw new Error('Unable to create XMLHttpRequest');
        }

        fillMethod = ( function() {
            var method = null;

            scriptElem.type = 'text/javascript';
            scriptElem.textContent = 'window.' + myID + '=1;';

            rootElem.insertBefore(scriptElem, rootElem.firstChild);

            if( window[myID] === 1 ) {
                method = 'textContent';
                delete window[myID];
            } else
                method = 'text';

            rootElem.removeChild(scriptElem);

            return method;
        }());
        
        if( settings & options.localStorage ) {
            preCached = JSON.parse(localStorage.getItem('supplyJS')) || {};
        }
    }());
    self.setDealer = function(path) {
        if( typeof path === 'string' )
            dealer = path;

        return self;
    };
    // files() takes an object as argument. That object should contain a "javascript" and a "stylesheet" property,
    // both referencing an array with filenames. That names get JSON.stringified** and are transfered to the backend script.   ** [json will get replaced through a standard query string]
    self.files = function(args) {
        var _jsfiles 	= args.javascript,
	        _cssfiles	= args.stylesheet,
	        _imagefiles	= args.images,
	        _callback	= args.callback,
	        _debug		= args.debug,
	        params		= [],
	        query		= '';

        my.reset();

        if( _jsfiles && toStr.call(_jsfiles) === "[object Array]" )
            settings |= options.loadjavascript;
        if( _cssfiles && toStr.call(_cssfiles) === "[object Array]" )
            settings |= options.loadstylesheet;
        if( _imagefiles && toStr.call(_imagefiles) === "[object Array]" )
            settings |= options.loadimages;

        if( _debug && _debug === true )
            settings |= options.debug;
        if( _callback && (typeof _callback === 'function' || typeof _callback === 'string') )
            settings |= options.callback;

        if( settings & options.loadstylesheet )
            params.push(my.serialize(_cssfiles, 'css'));
        if( settings & options.loadjavascript )
            params.push(my.serialize(_jsfiles, 'js'));
        if( settings & options.loadimages )
            params.push(my.serialize(_imagefiles, 'images'));
        if( settings & options.callback ) {
            if( typeof _callback === 'function' ) {
                self.listen('complete', _callback);
            } else if( typeof _callback === 'string' ) {
                if( _callback in window )
                    self.listen('complete', window[_callback]);
            }
        }

        if(!_debug ) {
            query = dealer + '?' + params.join('&');

            if( settings & options.compatibleIE ) {
                xhr.onprogress = function() {
                    my.readyStateHandler(true);
                };
                xhr.onload = function() {
                    my.readyStateHandler(true, true);
                };
            } else {
                xhr.onreadystatechange = function() {
                    my.readyStateHandler(false);
                };
            }

            // Try to use a GET request, but if we come close to the query string limitation (Internet Explorer
            // 2083 characters), switch over to POST to be save
            if( query.length < 2048 ) {
                xhr.open('GET', query, true);
                xhr.send(null);
            } else {
                xhr.open('POST', dealer, true);

		if(!(settings & options.compatibleIE) )
	            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

                xhr.send(params.join('&'));
            }
        } else { // debug mode
            my.attachScript(_jsfiles);
        }
    };
    // readStateHandler() handles XHR readystate 3+4. On 3 we initialize a timer which polls data from the
    // current XHR stream. When we reach 4(=complete), we call getLatestPacket(see below) a last time to get the last data
    my.readyStateHandler = function(IE, IEload) {
        if(!(settings & options.msie) || (settings & options.compatibleIE)) {
            if((IE && getLatestPacketInterval === null) || (xhr.readyState === 3 && getLatestPacketInterval === null)) {
                // start polling
                getLatestPacketInterval = window.setInterval( function() {
                    my.getLatestPacket();
                }, 25);
            }
        }

        if(xhr.readyState === 4 || IEload) {
            clearInterval(getLatestPacketInterval);
            my.getLatestPacket();

            if( settings & options.localStorage ) {
                localStorage.setItem('supplyJS', JSON.stringify(preCached));
            }

            if(listeners.complete && listeners.complete.length) {
                for (var n=0, len=listeners.complete.length; n < len; n++) {
                    listeners.complete[n].apply(window);
                }
            }
        }
    };
    // getLatestPacket receives the latest stream data from xhr.responseText
    // The "new" chunk of data(packet) is passed through processPacket(see below)
    my.getLatestPacket = function() {
        var length	= xhr.responseText.length,
        	packet	= xhr.responseText.substring(lastLength, length);

        my.processPacket(packet);
        lastLength	= length;
    };
    // processPacket(): This is where the magic happens. We do some string manipulation to pull out the
    // data of interest. We invoke self.currentStream by writting the current data into it.
    my.processPacket = function(packet) {
        if(packet.length < 1)
            return;

        var startPos 	= packet.indexOf(boundary),
        	endPos		= -1;

        if(startPos > -1) {
            if(my.currentStream) {
                endPos		= startPos;
                startPos	= -1;
            } else {
                endPos		= packet.indexOf(boundary, startPos + boundary.length);
            }
        }

        if(!my.currentStream) {
            my.currentStream = '';

            if(startPos > -1) {
                if(endPos > -1) {
                    var payload			= packet.substring(startPos, endPos);
                    my.currentStream	= my.currentStream + payload;

                    packet				= packet.slice(endPos);
                    my.processPayload();

                    //try {
                    my.processPacket(packet);
                    //} catch(e) { console && console.log('Supply Error: ', e); }
                } else {
                    my.currentStream	+= packet.substr(startPos);
                }
            }
        } else {
            if(endPos > -1) {
                var chunk			= packet.substring(0, endPos);
                my.currentStream   += chunk;

                packet 				= packet.slice(endPos);
                my.processPayload();

                my.processPacket(packet);
            } else {
                my.currentStream += packet;
            }
        }
    };
    // processPayload() splits the current stream into it's mime type & raw data.
    // It executes all event listeners that are attached to that mime-type
    my.processPayload = function() {
        my.currentStream	= my.currentStream.replace(boundary, '');

        var pieces		= my.currentStream.split(fieldDelimiter),
	        mime		= pieces[0],
	        filename	= pieces[1],
	        mtime		= pieces[2],
	        payload		= pieces[3];

        if (typeof listeners[mime] !== 'undefined') {
            for (var n = 0, len = listeners[mime].length; n < len; n++) {
                listeners[mime][n].call(my, payload, filename, mtime);
            }
        }

        delete my.currentStream;
    };
    my.attachScript = function(container) {
        var scr		= document.createElement('script'),
	        head	= document.getElementsByTagName('head')[0],
	        isArr	= toStr.call(container) === '[object Array]',
	        path	= isArr ? container.shift() : container;

        if(!path) {
            if(listeners.complete && listeners.complete.length) {
                for (var n=0, len=listeners.complete.length; n < len; n++) {
                    listeners.complete[n].apply(window);
                }
            }

            return;
        }

        scr.src		= '/js/' + path;
        scr.type	= 'text/javascript';

        scr.onload = scr.onreadystatechange = function() {
            if(scr.readyState) {
                if(scr.readyState === 'complete' || scr.readyState === 'loaded') {
                    scr.onreadystatechange = null;
                    isArr && my.attachScript(container);
                }
            } else {
                if( 'console' in window )
                    console.log(scr.src, ' attached');
                isArr && my.attachScript(container);
            }
        };
        head.insertBefore(scr, head.firstChild);
    };
    // serialize expects an array and a name to encode a query string
    my.serialize = function(arr, name) {
        var ret = [],
	        len	= arr.length,
	        hlen,
	        cached_obj,
	        i;

        if( toStr.call(arr) === '[object Array]' && typeof name === 'string') {
            if( settings & options.localStorage ) {
                for(i = 0; i < len; i++) {
                    cached_obj = (arr[i] in preCached) ? JSON.parse(preCached[arr[i]]) : '0';

                    ret.push([name, '=', arr[i], '~', cached_obj.modified].join(''));

                    if( cached_obj && cached_obj.mime === 'text/css' ) {
                        if (typeof listeners[cached_obj.mime] !== 'undefined') {
                            for (var n = 0, hlen = listeners[cached_obj.mime].length; n < hlen; n++) {
                                listeners[cached_obj.mime][n].call(my, cached_obj.src, cached_obj.filename, null);
                            }
                        }
                    }
                }
            } else {
                for(i = 0; i < len; i++) {
                    ret.push([name, '=', arr[i]].join(''));
                }
            }

            return ret.length ? ret.join('&') : undefined;
        }

        return undefined;
    };
    my.removeDuplicateNode = function(head, name) {
        var nodes 	= document.getElementsByTagName('style'),
        	len 	= nodes.length;

        while( len-- ) {
            if( nodes[len].getAttribute('name') === name )
                head.removeChild(nodes[len]);
        }
    };
    // listen() attaches an array of callback functions(event listeners) into listeners object.
    self.listen = function(mime, cb) {
        if(typeof listeners[mime] === 'undefined') {
            listeners[mime] = [];
        }

        if(typeof cb === 'function') {
            listeners[mime].push(cb);
        }
    };
    // ---------------------------------------------------------------------------------------
    // add event listeners for text/javascript & text/css mime types
    ( function() {
        self.listen('text/javascript', function(payload, filename, mtime) {
            if( settings & options.localStorage ) {
                if( payload === 'cached' ) {
                    payload = JSON.parse(preCached[filename]).src;
                } else {
                    preCached[filename] = JSON.stringify({
                        modified:	mtime,
                        src:		payload,
                        mime:		'text/javascript',
                        filename:	filename
                    });
                }
            }

            try {
                if( settings & options.useeval ) {
                    eval(payload);
                } else {
                    var head			= document.getElementsByTagName('head')[0] || document.documentElement,
                    	nscr			= document.createElement('script');

                    nscr.type			= 'text/javascript';
                    nscr[fillMethod]	= payload;
                    nscr.setAttribute('name', filename);

                    head.insertBefore(nscr, head.firstChild);

                    if( settings & options.removescripts )
                        head.removeChild(nscr);
                }
            } catch(err) {
                if( 'console' in window )
                    console.error(filename, ': Exception. Details -> ', err);
            }
        });
        self.listen('text/css', function(payload, filename, mtime) {
            if( settings & options.localStorage && filename && mtime ) {
                if( payload === 'cached' ) {
                    payload = JSON.parse(preCached[filename]).src;
                } else {
                    preCached[filename] = JSON.stringify({
                        modified:	mtime,
                        src:		payload,
                        mime:		'text/css',
                        filename:	filename
                    });
                }
            }

            var head			= document.getElementsByTagName('head')[0] || document.documentElement,
            	nstyle			= document.createElement('style');

            nstyle.type			= 'text/css';
            nstyle[fillMethod]	= payload;
            nstyle.setAttribute('name', filename);

            my.removeDuplicateNode(head, filename);

            head.insertBefore(nstyle, head.firstChild);

            if( settings & options.removescripts )
                head.removeChild(nstyle);
        });
    }());
    return(self);

}(window, window.document));