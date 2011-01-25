#!/usr/bin/perl

# MXHR Streamer
# Author: Andreas Goebel, Aug/2010

package Mxhr;

use MIME::Base64;
use strict;
use warnings;

sub new {
	my $class 			= shift;
	my $self			= {};
	$self->{_payloads} 	= [];
	$self->{_boundary}	= chr(1); #SOH
	$self->{_newline}	= chr(3); #ETX
	
	bless $self, $class;
	return $self;
}

sub getBoundary {
	my ($self) = @_;
	return $self->{_boundary};
}

sub addHtml {
	my ($self, $text, $name) = @_;
	$self->addPayload($text, 'text/html', $name);
}

sub addImage {
	my ($self, $image, $content_type, $name) = @_;
	my $encoded = encode_base64($image);
	$self->addPayload($encoded, $content_type, $name);
}

sub addJS {
	my ($self, $script, $name, $mtime) = @_;
	$self->addPayload($script, 'text/javascript', $name, $mtime);
}

sub addCSS {
	my ($self, $stylesheet, $name, $mtime) = @_;
	$self->addPayload($stylesheet, 'text/css', $name, $mtime);
}

sub addPayload {
	my ($self, $data, $content_type, $name, $mtime) = @_;
	push(@{$self->{_payloads}}, {
		'name'			=> $name,
		'data'			=> $data,
		'content_type'	=> $content_type,
		'mtime'			=> $mtime
	});
}

sub stream {
	my ($self) 		= @_;
	my $stream 		= [];
	my $version		= '1.0.2';	
	
	foreach my $payload(@{$self->{_payloads}}) {				
		push(@{$stream}, $payload->{content_type} . $self->{_boundary} . ($payload->{name} || "unnamed") . $self->{_boundary} . ($payload->{mtime} || "000") . $self->{_boundary} . $payload->{data});
	}		
	
	return $version . $self->{_newline} . join($self->{_newline}, @{$stream}) . $self->{_newline};
}

1;
