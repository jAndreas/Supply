#SupplyJS#

Delivering multiple Javascript & Stylesheet files in one request, using MXHR.

 `Example`:

    <script src="/js/supply.min.js?v=2"></script>
    <script type="text/javascript">
    supply.setDealer('/cgi-bin/supply.pl').files({
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
    
Only `supply.min.js` is loaded via the conventional `<script src=>` method. All other files in this example, are then
fetched on the server and pushed to the browser in a single request (instead of five). Since each request means overhead, this method
is pretty fast.

As a rule: The more files you're loading, the greater is the benefit you gain using Supply!

#Configuration#

You need to setup two things. First, supply.js needs to know the path and the name from the server-script part.
Either change the `dealer` variable directly in supply.js:

    dealer	= '/cgi-bin/supply.pl',		// server script which deals us the data
    	
or call `supply.setDealer()` before you call `supply.files()`:

    supply.setDealer('/cgi-bin/supply.pl');
    


The second thing that needs to be configured is the servers absolute path. This is done in `supply.pl`:

    my $html_dir	= "/var/www/typeofnan";
    
So if we pass `/js/init.min.js` to `supply.files()`, `supply.pl` will open

    /var/www/typeofnan/js/init.min.js`
    
Done.


#Moar server scripts!#

I just have a perl version online right now. But the function of the backend part is really trivial. Basically it is:

 - open a file
 - read the files content
 - concat it
 - send the concatinated string
 
I will follow up soon with a PHP version. I'd be happy about any contribution on that part too.
Anything is possible here, nodeJS, Rails, Python and whatnot.
