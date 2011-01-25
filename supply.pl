#!/usr/bin/perl

# MXHR Streamer
# Author: Andreas Goebel, Aug/2010

use strict;
use CGI;
use File::stat;
use Mxhr;

my $cgi 			= CGI->new();
my @jsfiles			= $cgi->param('js');
my @cssfiles		= $cgi->param('css');
my @imagefiles		= $cgi->param('images');
my $streamer		= new Mxhr();
my $jscontent		= "";
my $csscontent		= "";
my $imagecontent	= "";
my %options		= (
	js 		=> 0,
	css		=> 0
);

if (defined @jsfiles) {
	$options{'js'} 	= 1;
}

if (defined @cssfiles) {
	$options{'css'} = 1;
}

if (defined @imagefiles) {
	$options{'images'} = 1;
}

print $cgi->header(	-'type'							=> 'text/plain',
					-'charset'						=> 'windows-1252',
	                -'Access-Control-Allow-Origin'	=> '*' 
	              );

if ($options{'js'} || $options{'css'} || $options{'images'}) {
		my $mtime 		= undef;
		my @parts		= ();
		my $filename	= "";
		my $modified	= "";
		my $base_dir 	= "/var/www/typeofnan";
		
		foreach my $file (@cssfiles) {
			$csscontent = "";
			($filename, $modified) = split(/~/, $file);
			
			if( $filename =~ /(\.\.|~)/ ) { next; }
			
			$mtime = (stat($base_dir . '/' . $filename))->[9];
			
			if( int($mtime) > int($modified) || int($modified) == 0 ) {
				open (CSSFILE, $base_dir . '/' . $filename) or next;
				while(<CSSFILE>) {
					$csscontent .= $_;
				}
				close CSSFILE;
			}
			else {
				$csscontent = 'cached';
			}
			
			$streamer->addCSS($csscontent, $filename, $mtime);
		}
			
		foreach my $file (@jsfiles) {		
			$jscontent = "";
			($filename, $modified) = split(/~/, $file);
			
			if( $filename =~ /(\.\.|~)/ ) { next; }
			
			$mtime = (stat($base_dir . '/' . $filename))->[9];
		
			if( int($mtime) > int($modified) || int($modified) == 0 ) {				
				open (JSFILE, $base_dir . '/' . $filename) or next;			
				while(<JSFILE>) {
					$jscontent .= $_;	
				}
				close JSFILE;
			}
			else {
				$jscontent = 'cached';
			}
			
			$streamer->addJS($jscontent, $filename, $mtime);
		}
		
		foreach my $file (@imagefiles) {
			$imagecontent = "";
			($filename, $modified) = split(/~/, $file);
			
			if( $filename =~ /(\.\.|~)/ ) { next; }
			
			#no caching support for images currently - might go beyond the scope of the localStorage (5MB) too quickly.
			open (IMAGEFILE, $base_dir . '/' . $filename) or next;
			while(<IMAGEFILE>) {
				$imagecontent .= $_;
			}
			close IMAGEFILE;
			
			#very simple filetype detection
			if( $filename ~~ m/\.(\w+)$/ ) {
				$streamer->addImage($imagecontent, 'image/' . $1, $filename);
			}
		}
		
		# add more content
		
	print $streamer->stream();
}
