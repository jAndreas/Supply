#!/usr/bin/perl

# MXHR Streamer
# Author: Andreas Goebel, Aug/2010

use Mxhr;
use strict;
use CGI;

my $cgi 		= CGI->new();
my @jsfiles		= $cgi->param('js');
my @cssfiles	= $cgi->param('css');
my $streamer	= new Mxhr();
my $jscontent	= "";
my $csscontent	= ""; 
my $html_dir	= "/var/www/typeofnan";
my %options		= (
	js 		=> 0,
	css		=> 0
);

if (defined @jsfiles)
{
	$options{'js'} 	= 1;
}

if (defined @cssfiles)
{
	$options{'css'} = 1;
}

print $cgi->header(	-'type'							=> 'text/plain',
					-'charset'						=> 'utf-8',
	                -'Access-Control-Allow-Origin'	=> '*' 
	              );

if ($options{'js'} || $options{'css'} ) {			
		foreach my $file (@jsfiles)
		{		
			$jscontent = "";				
			open (JSFILE, $html_dir . $file) or next;			
			
			while(<JSFILE>){
				$jscontent .= $_;	
			}
			$streamer->addJS($jscontent, $file);
		}
		
		foreach my $file (@cssfiles)
		{
			$csscontent = "";
			open (CSSFILE, $html_dir . $file) or next;
			
			while(<CSSFILE>){
				$csscontent .= $_;
			}
			$streamer->addCSS($csscontent);
		}
		
		# add more content
		
	print $streamer->stream();
}
