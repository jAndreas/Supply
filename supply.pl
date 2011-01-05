#!/usr/bin/perl

# MXHR Streamer
# Author: Andreas Goebel, Aug/2010

use strict;
use CGI;
use File::stat;
use Mxhr;

my $cgi 		= CGI->new();
my @jsfiles		= $cgi->param('js');
my @cssfiles	= $cgi->param('css');
my $streamer	= new Mxhr();
my $jscontent	= "";
my $csscontent	= ""; 
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
					-'charset'						=> 'windows-1252',
	                -'Access-Control-Allow-Origin'	=> '*' 
	              );

if ($options{'js'} || $options{'css'} ) {
		my $mtime 		= undef;
		my @parts		= ();
		my $filename	= "";
		my $modified	= "";
		my $javascript_dir = "/var/www/typeofnan";
                my $css_dir = "/var/www/typeofnan";
		
		foreach my $file (@cssfiles)
		{
			$csscontent = "";
			
			($filename, $modified) = split(/~/, $file);
			
			if( $file =~ /(\.\.|~)/ ) { next; };
			
			$mtime = (stat($css_dir . '/' . $filename))->[9];
			
			if( int($mtime) > int($modified) || int($modified) == 0 ) 
			{
				open (CSSFILE, $css_dir . '/' . $filename) or next;
				
				while(<CSSFILE>){
					$csscontent .= $_;
				}
				
				close CSSFILE;
			}
			else
			{
				$csscontent = 'cached';
			}
			
			$streamer->addCSS($csscontent, $filename, $mtime);
		}
			
		foreach my $file (@jsfiles)
		{		
			$jscontent = "";
			
			($filename, $modified) = split(/~/, $file);
			
			if( $file =~ /(\.\.|~)/ ) { next; };
			
			$mtime = (stat($javascript_dir . '/' . $filename))->[9];
		
			if( int($mtime) > int($modified) || int($modified) == 0 ) 
			{				
				open (JSFILE, $javascript_dir . '/' . $filename) or next;			
				
				while(<JSFILE>)
				{
					$jscontent .= $_;	
				}
				
				close JSFILE;
			}
			else
			{
				$jscontent = 'cached';
			}
			
			$streamer->addJS($jscontent, $filename, $mtime);
		}
		
		# add more content
		
	print $streamer->stream();
}
