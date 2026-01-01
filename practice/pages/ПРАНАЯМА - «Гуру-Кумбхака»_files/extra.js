// Post voting system with Ajax

FORUM.PartnerVote = function(post_id,vote) {
    return true;
};

$(function() {
	$('.topic div.post-vote, .topic li.pa-respect').find('a[href*="relation.php?"]').on('click', function(e) {
		e.preventDefault();
		var a = $(this).prop('href');
		var pid = a.match(/\?id=(\d+)/)[1];
		var uid = $(this).parents('.post').find('.pl-email a[href*="profile.php?"]').prop('href');
		if (uid) uid = uid.match(/\?id=(\d+)$/)[1];
		var v = a.match(/&v=(\d+)/)[1] == 0 ? -1 : 1;
		$('#post-' + pid + '-vote').hide();
		if(FORUM.PartnerVote(pid, v)) $.get(a + '&format=json', function(data) {
			if (data.error && data.error.message) $.jGrowl(data.error.message);
			if (data.delta) {
				var pr = data.response;
				if (pr > 0) pr = '+' + pr.toString();
				$('#p' + pid + ' .post-rating a').text(pr);
				var $res = $('.pl-email a[href$="profile.php?id=' + uid + '"]').parents('.post').find('.pa-respect');
				var $pos = $('.pl-email a[href$="profile.php?id=' + UserID + '"]').parents('.post').find('.pa-positive');

				function replaceRating(sel, v, revert) {
					var html = $(sel).html(), delta = v;
					if (!html) return;
					if (revert) delta = delta > 0 ? -1 : 1;
					if (v > 0) {
						html = html.replace(/\[\+(\d+)\//g, function(str, p1, b, p2) {
							return '[+' + (parseInt(p1) + delta) + '/';
						});
					} else {
						html = html.replace(/\/-(\d+)\]/g, function(str, p1, b, p2) {
							return '/-' + (parseInt(p1) - delta) + ']';
						});
					}
					$(sel).html(html);
				};
				if ($res.length && $res.html().indexOf('[') != -1 || $pos.length && $pos.html().indexOf('[') != -1) {
					$res.each(function() {
						replaceRating(this, v);
					});
					$pos.each(function() {
						replaceRating(this, v);
					});
					if (Math.abs(data.delta) == 2) {
						v = v > 0 ? -1 : 1;
						$res.each(function() {
							replaceRating(this, v, 1);
						});
						$pos.each(function() {
							replaceRating(this, v, 1);
						});
					}
				} else {
					var d0 = $res.find('span:not(.fld-name)').html(),
						p0 = $pos.find('span:not(.fld-name)').html();
					var d1 = parseInt(d0) + v;
					if (p0) {
						var p1 = parseInt(p0) + v;
					}
					if (d1 && d1 > 0) {
						d1 = '+' + d1;
					}
					if (p1 && p1 > 0) {
						p1 = '+' + p1;
					}
					$res.find('span:not(.fld-name)').html(d1);
					if(p0) $pos.find('span:not(.fld-name)').html(p1);
				}
			}
		});
	});
});

// Post share link

function sharelink_init(element) {
	element.tooltipsy({
		alignTo: 'element',
		offset: [-1, 0],
		showEvent: 'click',
		hideEvent: 'click',
		show: function (e, $el) {
			var $a = $(e.currentTarget);
			$el.css({'position': 'absolute','top':($a.offset().top + 25) + 'px','left': ($a.offset().left + $a.width()- 162) +'px'}).fadeIn(200);
			$a.addClass('open');
		},
		hide: function (e, $el) {
			var $a = $(e.currentTarget); $(e.currentTarget).removeClass('open'); $el.fadeOut(200);
		},
		content: function($el) {
			var providers = ['facebook','vkontakte','odnoklassniki','mailru','twitter','linkedin','reddit','tumblr']
			var output = '';
			var a = $el.prop('href');
			var pid = a.match(/#p(\d+)$/)[1];
			$.each(providers, function(key, val) {
				output += '<a class="social social-'+val+'" href="/share.php?p='+val+'&amp;pid='+pid+'" target="_blank" title="'+val+'"></a>'
			});
			return '<div class="post-share-tip"><div class="post-share-legend"><span>'+FORUM.get('topic.language.share_legend')+'</span></div><div class="post-share-icons">'+output+'</div></div>';
		},
		css: {'background': 'rgba(0,0,0,0.8)','border-radius': '3px'}
	});
}

$(function() {
	sharelink_init($('.topic .sharelink'));
	var busy = false;
	$('body').on('click', '.post-share-tip', function(e) {
		busy = true;
		setTimeout(function() { busy = false }, 20);
	}).on('click', function() {
		if (!busy && $('.post-share-tip:visible').length) {
			$('.topic .sharelink.open').trigger('click');
		}
	});

	$('.topic .translatelink').on('click', function(e) {
		e.preventDefault();
		if ($(this).hasClass('translation-busy')) return false;
		
		var post = $(this).closest('.post'),
			content = post.find('.post-content'),
			pid = +post.attr('id').substr(1);
		
		if ($(this).hasClass('show-original')) {
			content.empty().append(post.data('original-content')).append(post.data('post-sig').clone());
			$(document).trigger($.Event('pun_translate', {'sender': content, 'pid': pid}));
			$(this).removeClass('show-original').text(FORUM.get('topic.language.translate'));
			return;
		}
		
		$(this).addClass('translation-busy');
	
		$.get('/api.php', {
			method: 'post.getTranslation',
			post_id: pid,
			language: window.UserLanguage || $('html').attr('lang')
		}, function(data) {
			if (data.response) {
				var sig = post.find('.post-sig').detach();
				var html = content.html();
				post.data('original-content', html).data('post-sig', sig);
				content.empty().append(data.response.message).append(sig.clone());
				$(document).trigger($.Event('pun_translate', {'sender': content, 'pid': pid}));
				$(e.target).addClass('show-original').text(FORUM.get('topic.language.show_original'));
			}
		}).always(function() {
			$(e.target).removeClass('translation-busy');
		});
	});

	$(document).on('pun_preedit', function() {
		$('.topic .translatelink.show-original').trigger('click');
	});
});

// toggleSpoiler for opening or closing spoilers

function toggleSpoiler(element) {
	var noscript = $(element).siblings('script'), blockquote = $(element).next('blockquote');
	if (noscript.length) {
		blockquote.html(noscript.text());
		noscript.remove();
		$(element).parent('.spoiler-box').trigger($.Event('spoiler.firstOpen', {'sender': element}));
	}
	$(element).toggleClass('visible');
	blockquote.toggleClass('visible');
	$(element).parent('.spoiler-box').trigger($.Event('spoiler.toggle', {'sender': element}));
}
