#Supply#

Serving multiple Javascript & Stylesheet files in one request, using MXHR.

`Example``:

    <script src="/js/supply.min.js?v=2"></script>
    <script type="text/javascript">	
	supply.files({
		debug: false,
		javascript: [
			'/js/jquery-1.4.2.min.js',
			'/js/jquery-ui-1.8.4.custom.min.js',
			'/js/init.min.js',
			'/js/box.min.js',
			'/js/app.min.js'
		]			
	});				
    </script>