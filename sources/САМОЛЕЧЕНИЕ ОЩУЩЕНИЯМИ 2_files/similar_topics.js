/****************************************************
 * Displaying the similar topics when creating a topic
 * Author: Alex_63
 * Date: 11.06.2017 / 28.05.2024
****************************************************/

if (window.self === window.top) $(document).pun_aboutReady(function() {
	if (!($('#pun-post,#pun-poll').length && document.URL.match(/\?fid=/)))
		return;

	var lang_obj = {
		'Похожие темы' : {en: 'Similar topics'},
		'Ответов' : {en: 'Replies'},
		'Последнее сообщение' : {en: 'Last post'},
		'В форуме' : {en: 'In forum'},
		'По вашему запросу ничего не найдено' : {en: 'Your search returned no hits'}
	}, lang = $('html')[0].lang;
	function _(text) {
		return (lang == 'ru' || !(lang_obj[text] && lang_obj[text][lang])) ? text : lang_obj[text][lang]
	}

	var transAnsiAjaxSys = [];
	var arr = [0x402, 0x403, 0x201A, 0x453, 0x201E, 0x2026, 0x2020, 0x2021, 0x20AC, 0x2030, 0x409, 0x2039,
		0x40A, 0x40C, 0x40B, 0x40F, 0x452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, '0', 0x2122,
		0x459, 0x203A, 0x45A, 0x45C, 0x45B, 0x45F, 0x0A0, 0x40E, 0x45E, 0x408, 0x0A4, 0x490, 0x0A6, 0x0A7, 0x401,
		0x0A9, 0x404, 0x0AB, 0x0AC, 0x0AD, 0x0AE, 0x407, 0x0B0, 0x0B1, 0x406, 0x456, 0x491, 0x0B5, 0x0B6, 0x0B7,
		0x451, 0x2116, 0x454, 0x0BB, 0x458, 0x405, 0x455, 0x457, 0x410, 0x411, 0x412, 0x413, 0x414, 0x415, 0x416,
		0x417, 0x418, 0x419, 0x41A, 0x41B, 0x41C, 0x41D, 0x41E, 0x41F, 0x420, 0x421, 0x422, 0x423, 0x424, 0x425,
		0x426, 0x427, 0x428, 0x429, 0x42A, 0x42B, 0x42C, 0x42D, 0x42E, 0x42F, 0x430, 0x431, 0x432, 0x433, 0x434,
		0x435, 0x436, 0x437, 0x438, 0x439, 0x43A, 0x43B, 0x43C, 0x43D, 0x43E, 0x43F, 0x440, 0x441, 0x442, 0x443,
		0x444, 0x445, 0x446, 0x447, 0x448, 0x449, 0x44A, 0x44B, 0x44C, 0x44D, 0x44E, 0x44F
	];
	var arLng = arr.length;
	for (var i = 0; i < arLng; i++) transAnsiAjaxSys[arr[i]] = i + 128;
	for (var i = 0x410; i <= 0x44F; i++) transAnsiAjaxSys[i] = i - 0x350;

	var _encodeURIwin1251 = function(str) {
		var ret = [];
		for (var i = 0; i < str.length; i++) {
			var n = str.charCodeAt(i);
			if (typeof transAnsiAjaxSys[n] != 'undefined')
				n = transAnsiAjaxSys[n];
			if (n <= 0xFF)
				ret.push(n);
		}
		return escape(String.fromCharCode.apply(null, ret)).replace(/\+/mg, '%2B');
	}

	var style = '<style>#s-topics td{border:none 0 transparent!important}#pun .similar-topics #s-topics th{border:none 0!important;background:none!important;font-weight:700!important;font-size:1em!important;text-align:left;padding:0}#s-topics td.t1{padding:.6em 1em .6em .6em;}#s-topics .t1 em{font-size:.9em}#s-topics .t1 a{font-weight:700}#s-topics td.t2,#s-topics td.t3{padding:.6em 0;}#s-topics .t2{text-align:center!important;width:12%}</style>';
	$('head').append(style);

	function setFndTable(sel, data) {
		var L1 = '<div class="similar-topics"><br/><table id="s-topics" cellspacing="0" tableborder="0"></table></div>';
		var L2 = '<thead><tr><th class="t1"><strong>' + _('Похожие темы') + ':</strong></th><th class="t2">' + _('Ответов') + '</th><th class="t3">' + _('Последнее сообщение') + '</th></tr>';

		sel.parent().append(L1);
		$('#s-topics').prepend(L2);
		$(data).find('#pun-main tbody tr').each(function(i) {
			if (i >= 10) return;
			var name = $(this).find('.tcl a:first').text().replace(/‡.*&(amp;?)?/mgi, '').replace(/†.*¤/mgi, '').replace(/¤.*¤/mgi, '');
			var href = $(this).find('.tcl a:first').attr('href'),
			    auth = $(this).find('.tcl .byuser').text(),
			    repl = $(this).find('.tc3').text();
			var For = ' ' + $(this).find('.tc2').html(),
			    last = $(this).find('.tcr>a').text(),
			    a = '<a href="' + href + '">' + name + '</a>';
			var tr = '<tr><td class="t1">' + a + '&nbsp;' + auth + '<br/><em>' + _('В форуме') + ':' + For + '</em></td><td class="t2">' + repl + '</td><td class="t3">' + last + '</td></tr>';
			$('#s-topics').append(tr);
		});
	};

	$('input#fld3[name="req_subject"]').on('input change', function(e) {
		var sel = $(this),
			val = sel.val(),
			t = 0,
			timer;
		if (e.type == 'input') t = 600;
		if ($.trim(val).length < 3) return;

		clearTimeout(timer);
		timer = setTimeout(function() {
			$.get('/search.php?nohead&action=search&keywords=' + _encodeURIwin1251(val) + '&search_in=-1&sort_by=0&sort_dir=DESC&show_as=topics', function(data) {
				sel.parent().find('.similar-topics').remove();
				if ($(data).find('.main').text().indexOf(_('По вашему запросу ничего не найдено')) != -1) return;
				else setFndTable(sel, data);
			});
		}, t);

	});
});