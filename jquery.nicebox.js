(function($) {

	var nicebox = {
		elems: [],
		galleries: {},
		dom: {},
		currentIndex: false
	};
	
	var niceboxInit = false;
	
	$.nicebox = nicebox;

	$.fn.nicebox = function(options) {
		return this.each(function() {
			var me = this;
			nicebox.bind(me, options);
		});
	};

	nicebox.init = function() {
		if (niceboxInit) {
			return;
		}
		niceboxInit = true;

		// Shortcuts to optimize performance
		nicebox.dom.$window = $(window);
		nicebox.dom.$document = $(document);
		nicebox.dom.$body = $('body');

		// Keyboard handler
		nicebox.dom.$document.keydown(function(e) {
			// Catch and execute keyboard function
			if (nicebox.keyboard(e.keyCode, true)) {
				if (e.preventDefault) {
					e.preventDefault();
				}
				return false;					
			}
		}).keypress(function(e) {
			// Catch but don't execute keyboard function
			if (nicebox.keyboard(e.keyCode, false)) {
				if (e.preventDefault) {
					e.preventDefault();
				}
				return false;					
			}
		});

		// Detect IOS
		nicebox.ios = /(iPhone|iPod|iPad)/.test(window.navigator.userAgent);
		if (nicebox.ios) {
			nicebox.dom.$body.addClass("ios");
		}

		// Detect IE6 using own technique instead of deprecated jQuery.browser
		nicebox.msie6 = window.XMLHttpRequest === undefined && ActiveXObject !== undefined;
		// Add fixes for IE6 -- IE6 has and always will have issues though
		if (nicebox.msie6) {
			nicebox.dom.$iframe = $('<iframe id="niceboxIframe"></iframe>').hide();
			nicebox.dom.$body.append(nicebox.dom.$iframe);
			// Fix IE background image caching
			if (document && document.execCommand) {
				try {
					document.execCommand("BackgroundImageCache", false, true);
				} catch(e) {
					// Silent fail
				}				
			}
		}

		// The overlay
		nicebox.dom.$overlay = $('<div id="niceboxOverlay">&nbsp;</div>').hide();
		nicebox.dom.$body.append(nicebox.dom.$overlay);
		nicebox.dom.$overlay.click(nicebox.finish);
		
		// The loading animation
		nicebox.dom.$loading = $('<div id="niceboxLoading">&nbsp;</div>').hide();
		nicebox.dom.$body.append(nicebox.dom.$loading);
		nicebox.dom.$loading.click(nicebox.finish);
		
		// The pop-up
		nicebox.dom.$popup = $('<div id="niceboxPopUp"></div>').hide();
		nicebox.dom.$content = $('<div id="niceboxContent"></div>').hide();
		nicebox.dom.$info = $('<div id="niceboxInfo"></div>').hide();
		nicebox.dom.$title = $('<span id="niceboxTitle"></span>');
		nicebox.dom.$controls = $('<span id="niceboxControls"></span>');
		nicebox.dom.$galleryControls = $('<span id="niceboxGalleryControls"></span>');
		nicebox.dom.$close = $('<a href="#" id="niceboxClose" title="Close">X</a>').click(function() {
			nicebox.finish();
			return false;
		});
		nicebox.dom.$controls.append(nicebox.dom.$galleryControls).append(nicebox.dom.$close);
		nicebox.dom.$info.append(nicebox.dom.$title).append(nicebox.dom.$controls);
		nicebox.dom.$popup.append(nicebox.dom.$content).append(nicebox.dom.$info);
		nicebox.dom.$body.append(nicebox.dom.$popup);
		
		// Window resize handler
		nicebox.dom.$window.resize(function() {
			if (nicebox && nicebox.active && nicebox.position && nicebox.active()) {
				nicebox.position();
			}
		});
		
	};

	nicebox.keyboard = function(key, execute) {
		var f, keyMap = {
			27:	nicebox.finish,
			37: nicebox.prev,
			38: nicebox.prev,
			39: nicebox.next,
			40: nicebox.next
		};
		if (nicebox.active()) {
			f = keyMap[key];
			if ($.isFunction(f)) {
				if (execute) {
					f();					
				}
				return true; // we found a function for this key
			}
		}
		return false; // we didn't find a function for this key
	};

	nicebox.register = function(elem, options) {
		var $elem = $(elem), niceboxIndex = $elem.data('niceboxIndex');
		if (niceboxIndex !== undefined) {
			return;
		}
		
		var optionsFromElement = nicebox.optionsFromElement(elem);
		var o = $.extend({}, $.fn.nicebox.defaults || {}, optionsFromElement, options || {});
		
		nicebox.init();
		niceboxIndex = nicebox.elems.length;
		
		o.index = niceboxIndex;
		o.$elem = $elem;
		o.url = o.url || $elem.attr('href');
		o.optionsFromElement = optionsFromElement;
		
		nicebox.elems[niceboxIndex] = o;
		$elem.data('niceboxIndex', niceboxIndex)

		if (o.gallery) {
			if (!nicebox.galleries[o.gallery]) {
				nicebox.galleries[o.gallery] = [];
			}
			nicebox.galleries[o.gallery].push(niceboxIndex);
		}
		
	}

	nicebox.bind = function(elem, options) {
		var $elem = $(elem);
		nicebox.register(elem, options);
		$elem.click(function() {
			try {
				nicebox.popup(elem);				
			} catch(e) {
				alert('Error launching popup.');
			}
			return false;
		});
	};
	
	nicebox.active = function() {
		return nicebox.currentIndex !== false;
	}
	
	nicebox.popup = function(elem, options) {
		var $elem = $(elem), index, o, playerName, player;
		nicebox.register(elem, options);
		index = $elem.data('niceboxIndex');
		o = nicebox.elems[index];

		if (!o) {
			alert('Illegal DOM element for popup');
			return false;
		}

		if (!nicebox.active()) {
			nicebox.callHook('onOpen', o);
		}
		
		// Find the correct player
		playerName = o.player || nicebox.player(o.url);
		if ($.isFunction(playerName)) {
			player = playerName;
		} else {
			player = nicebox.players[playerName];
		}
		if (!$.isFunction(player)) {
			alert('Cannot find player for this link');
			return false;
		}
		
		// Resize loading element to match current popup (if visible)
		if (nicebox.dom.$popup.is(':visible')) {
			nicebox.dom.$loading.addClass('niceboxLoading');
			nicebox.dom.$loading.width(nicebox.dom.$popup.width());
			nicebox.dom.$loading.height(nicebox.dom.$popup.height());
		} else {
			nicebox.dom.$loading.removeClass('niceboxLoading');
		}
		nicebox.position(); // position now to make sure we are centered
		nicebox.currentIndex = index;
		nicebox.showOverlay();
		nicebox.dom.$popup.hide();
		nicebox.dom.$loading.show();
		nicebox.dom.$content.html('');
		player(nicebox.dom.$content, o);
	};
	
	nicebox.complete = function(options, $elem) {
		var title = '', showInfo = false;
		var galleryName = options.gallery;
		if (!nicebox.active()) {
			return; // Cancelled while loading asynchronously, it happens
		}
		if (!$elem) {
			$elem = nicebox.dom.$content;
		} else {
			$elem = $($elem); // Force to jQuery just to be safe
		}
		nicebox.dom.$loading.hide();
		nicebox.dom.$popup.show();
		if (options.width) {
			$elem.width(options.width);
		}
		if (options.height) {
			$elem.height(options.height);
		}
		nicebox.dom.$content.show();
		if (options.onClick) {
			if ($.isFunction(options.onClick)) {
				nicebox.dom.$content.bind('click', options.onClick);
			} else {
				nicebox.dom.$content.bind('click', function () {
					document.location.href = options.onClick;
				});				
			}
			nicebox.dom.$content.css({ cursor: 'pointer' });			
		} else {
			nicebox.dom.$content.css({ cursor: 'default' });			
		}
		if (options.showTitle) {
			title = options.title;
			if ($.isFunction(title)) {
				title = title(options);
			}
			if (!title && options.showTitle !== 'auto') {
				title = options.url || 'Unknown';
			}
			if (title) {
				showInfo = true;
			}
		}
		nicebox.dom.$title.html(title || '&nbsp;');
		nicebox.dom.$galleryControls.html('');
		if (galleryName) {
			var gallery = nicebox.galleries[galleryName];
			var galleryIndex = $.inArray(options.index, gallery);
			var galleryCount = gallery.length;
			var $prev, $next, prevIndex = galleryIndex - 1, nextIndex = galleryIndex + 1;
			if (prevIndex >= 0) {
				$prev = $('<a href="#">&lt;</a>').click(nicebox.prev);
			} else {
				$prev = $('<span>&lt;</span>');
			}
			if (nextIndex < galleryCount) {
				$next = $('<a href="#">&gt;</a>').click(nicebox.next);
			} else {
				$next = $('<span>&gt;</span>');
			}			
			nicebox.dom.$galleryControls.append($prev).append(' ' + (galleryIndex + 1) + ' / ' + galleryCount + ' ').append($next).append(' ');
			showInfo = true;
		}
		if (showInfo) {
			nicebox.dom.$info.show();			
		} else {
			nicebox.dom.$info.hide();			
		}
		nicebox.maxSize($elem);		
		nicebox.position();
		nicebox.callHook('onShow', options);
	};

	nicebox.player = function(url) {
		var baseUrl = url, pos = baseUrl.indexOf('?');
		
		if (pos !== -1) {
			baseUrl = baseUrl.substr(0, pos);
		}

		if (baseUrl.match(/(jpg|jpeg|png|gif|bmp)$/i)) {
			return 'image';
		} else if (baseUrl.match(/http:\/\/(www\.){0,1}youtube.com\/watch/i)) {
			return 'youtube';
		} else if (baseUrl.match(/^http/i)) {
			return 'iframe';
		} else {
			return 'ajax';
		}
		
	};
	
	nicebox.showOverlay = function() {
		if (nicebox.dom.$iframe) {
			nicebox.dom.$iframe.show();			
		}
		if (nicebox.dom.$overlay) {
			nicebox.dom.$overlay.show();			
		}
	};

	nicebox.hideOverlay = function() {
		if (nicebox.dom.$overlay) {
			nicebox.dom.$overlay.hide();
		}
		if (nicebox.dom.$iframe) {
			nicebox.dom.$iframe.hide();			
		}
	};

	nicebox.prev = function() {
		nicebox.move(-1);
	};
	
	nicebox.next = function() {
		nicebox.move(+1);
	};
	
	nicebox.move = function(i) {
		var options = nicebox.elems[nicebox.currentIndex] || {};
		var galleryName = options.gallery;
		if (galleryName) {
			var gallery = nicebox.galleries[galleryName];
			var galleryIndex = $.inArray(options.index, gallery);
			var galleryCount = gallery.length;
			var newIndex = galleryIndex + i;
			if (newIndex >= 0 && newIndex < galleryCount) {
				nicebox.popup(nicebox.elems[gallery[newIndex]].$elem);
			}
		}
	};
	
	nicebox.finish = function() {
		var options = nicebox.elems[nicebox.currentIndex] || {};
		nicebox.currentIndex = false;
		nicebox.hideOverlay();
		nicebox.dom.$popup.hide();
		nicebox.callHook('onClose', options);
	};

	nicebox.callHook = function(event, options) {
		var f = options[event];
		if (f && $.isFunction(f)) {
			return f(options);
		}
	};
	
	nicebox.position = function() {
		var scrollTop = 0;
		var scrollLeft = 0;
		var winWidth = nicebox.dom.$window.width();
		var winHeight = nicebox.dom.$window.height();
		if (nicebox.msie6) {
			scrollTop = nicebox.dom.$document.scrollTop();
			scrollLeft = nicebox.dom.$document.scrollLeft();
		}
		nicebox.dom.$popup.css({
			left: scrollLeft + Math.max((winWidth - nicebox.dom.$popup.outerWidth()) / 2, 0),
			top: scrollTop + Math.max((winHeight - nicebox.dom.$popup.outerHeight()) / 3, 0)
		});
		nicebox.dom.$loading.css({
			left: scrollLeft + Math.max((winWidth - nicebox.dom.$loading.outerWidth()) / 2, 0),
			top: scrollTop + Math.max((winHeight - nicebox.dom.$loading.outerHeight()) / 3, 0)
		});
	};
	
	nicebox.maxSize = function($elem) {
		var winWidth = nicebox.dom.$document.width();
		var winHeight = nicebox.dom.$window.height();
		var maxWidth = Math.min(winWidth * .9);
		var maxHeight = Math.min(winHeight * .8);
		var elemWidth = $elem.width();
		var elemHeight = $elem.height();
		var aspect = $elem.is('img');
		var aspectX = 0;
		var aspectY = 0;
		var newWidth = false;
		var newHeight = false;
		if (elemWidth > maxWidth) {
			newWidth = maxWidth;
		}
		if (elemHeight > maxHeight) {
			newHeight = maxHeight;
		}
		if (newWidth) {
			$elem.width(newWidth);
			aspectX = newWidth / elemWidth;
		}
		if (newHeight) {
			$elem.height(newHeight);
			aspectY = newHeight / elemHeight;
		}
		if (aspect && (aspectX || aspectY)) {
			aspect = Math.min(aspectX, aspectY);
			newWidth = elemWidth * aspect;
			newHeight = elemHeight * aspect;
		}
		if (newWidth) {
			$elem.width(newWidth);
		}
		if (newHeight) {
			$elem.height(newHeight);
		}
	};

	nicebox.optionsFromElement = function(elem) {
		var $elem = $(elem), options = {};
		var title = $elem.attr('title'), rel = $elem.attr('rel');
		var parts, part, i, key, value;
		
		if (title) {
			options.title = title;
		}
		
		if (rel) {
			parts = rel.split(';');
			for (i = 0; i < parts.length; i++) {
				part = parts[i].split('=');
				if (part.length == 1) {
					key = 'gallery';
					value = part;
				} else {
					key = part.shift();
					value = part.join('=');
				}
				value = unescape(value);
				if (value.match(/^[0-9]+$/)) {
					value = parseInt(value);
				}
				options[key] = value;
			}
		}
		
		return options;
	};
	
	nicebox.players = {
		ajax: function($elem, options) {
			$elem.load(options.url, function() {
				$(function() {
					$elem.unbind('load');
					nicebox.complete(options);					
				});
			});
		},
		image: function($elem, options) {
			var $img = $('<img style="display:block;border:0;margin:0;padding:0">');
			$elem.append($img);
			$img.load(function() {
				$img.unbind('load');
				nicebox.complete(options, $img);
			});
			$img.attr('src', options.url);
		},
		iframe: function($elem, options) {
			var $iframe = $('<iframe frameborder="0" style="display:block;border:0;margin:0;padding:0"></iframe>');
			$elem.html($iframe);
			$iframe.load(function() {
				$iframe.unbind('load');
				nicebox.complete(options, $iframe);
			}).attr('src', options.url);
		},
		youtube: function($elem, options) {
			var w = parseInt(options.width) || 425;
			var h = parseInt(options.height) || 344;
			var url = options.url.replace('watch?v=', 'v/');
			options.width = w;
			options.height = h;
			$elem.html('<object width="' + w + '" height="' + h + '"><param name="movie" value="' + url + '"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="' + url + '" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="' + w + '" height="' + h + '"></embed></object>');
			nicebox.complete(options);
		}
	};

	$.fn.nicebox.defaults = {
		showTitle: 'auto'
	};

})(jQuery);
