/****************************************************
 * Fast post moving v1.0.2
 * Author: Alex_63
 * Date: 06.06.2017 / 20.06.2017 / 10.02.2023 / 07.02.2025
 * 10.02.2023 - правки для корректной работы скрипта с подфорумами mybb.ru от Sachimot
 * 07.02.2025 cosmetic (Alex_63)
****************************************************/
 
if (GroupID <= 2) $(document).ready(function() {
	if (!$("#pun-multimove").length)
		return;
 
	var lang_obj = {
		'Введите URL адрес темы, в которую необходимо перенести выбранные сообщения' : {en: 'Enter the URL of topic in which you want to move selected posts'},
		'Переместить' : {en: 'Move'},
		'Выберите форум или введите ключевое слово' : {en: 'Select a forum or enter keywords'},
		'Выберите тему для переноса' : {en: 'Select the topic for moving'},
		'Поиск' : {en: 'Search'},
		'Форумы' : {en: 'Forums'},
		'Форум' : {en: 'Forum'},
		'Тема' : {en: 'Topic'},
		'Выбрать' : {en: 'Select'},
		'Перенести сообщения' : {en: 'Move posts'},
		'Не найдено ни одной темы' : {en: 'No topics found'},
		'по запросу' : {en: 'for'},
		'Уведомление' : {en: 'Notification'},
		'Закрыть' : {en: 'Close'},
		'Сообщения перемещены' : {en: 'Post have been successfully moved'},
		'Перейти в тему' : {en: 'Go to topic'},
		'выбрать еще сообщения для переноса' : {en: 'select more messages to move'},
		'Произошла ошибка. Попробуйте повторить действие позднее.' : {en: 'An error occured. Try again later.'},
		'Не выбраны сообщения для переноса.' : {en: 'No posts selected for moving.'}
	}, lang = $('html')[0].lang;
	function _(text) {
		return (lang == 'ru' || !(lang_obj[text] && lang_obj[text][lang])) ? text : lang_obj[text][lang]
	}
	var transAnsiAjaxSys = [];
	var arr=[0x402,0x403,0x201A,0x453,0x201E,0x2026,0x2020,0x2021,0x20AC,0x2030,0x409,0x2039,
		0x40A,0x40C,0x40B,0x40F,0x452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,'0',0x2122,
		0x459,0x203A,0x45A,0x45C,0x45B,0x45F,0x0A0,0x40E,0x45E,0x408,0x0A4,0x490,0x0A6,0x0A7,0x401,
		0x0A9,0x404,0x0AB,0x0AC,0x0AD,0x0AE,0x407,0x0B0,0x0B1,0x406,0x456,0x491,0x0B5,0x0B6,0x0B7,
		0x451,0x2116,0x454,0x0BB,0x458,0x405,0x455,0x457,0x410,0x411,0x412,0x413,0x414,0x415,0x416,
		0x417,0x418,0x419,0x41A,0x41B,0x41C,0x41D,0x41E,0x41F,0x420,0x421,0x422,0x423,0x424,0x425,
		0x426,0x427,0x428,0x429,0x42A,0x42B,0x42C,0x42D,0x42E,0x42F,0x430,0x431,0x432,0x433,0x434,
		0x435,0x436,0x437,0x438,0x439,0x43A,0x43B,0x43C,0x43D,0x43E,0x43F,0x440,0x441,0x442,0x443,
		0x444,0x445,0x446,0x447,0x448,0x449,0x44A,0x44B,0x44C,0x44D,0x44E,0x44F];
	var arLng = arr.length;
	for (var i = 0; i < arLng; i++)transAnsiAjaxSys[arr[i]]=i+128;
	for (var i = 0x410; i <= 0x44F; i++) transAnsiAjaxSys[i] = i - 0x350; // А-Яа-я
 
	var encodeURIwin1251 = function(str){
		var ret = [];
		for (var i = 0; i < str.length; i++) {
			var n = str.charCodeAt(i);
			if (typeof transAnsiAjaxSys[n] != 'undefined')
				n = transAnsiAjaxSys[n];
			if (n <= 0xFF)
				ret.push(n);
		}
		return escape(String.fromCharCode.apply(null, ret)).replace(/\+/mg,'%2B');
	};
	window.movePostsForm = {};
	var L = $('link[rel="up"]').attr("href").match(/id=(\d+)$/)[1];
	function h() {
		var a = "  ";
		$("#Move_Forum").find("option").each(function() {
			var d = $(this).parent("optgroup").attr("label");
			if (!d) {
				return
			}
			if (!SUBF.hasSmb(d)) {
				return
			}
			var c = $(this).parents("select").find("option:text('" + d + "')").parent("optgroup").attr("label");
			if (typeof(c) != "undefined" && SUBF.hasSmb(c)) {
				$(this).html(a + " " + $(this).html())
			}
		});
		$("#Move_Forum").find('optgroup[label^="#"],optgroup[label^="' + SUBF.smb + '"]').each(function() {
			var d = $(this).attr("label");
			var c = a + " ";
			$(this).find("option").each(function() {
				if ($(this).html().indexOf(a + " " + a) == -1) {
					$(this).html(c + $(this).html())
				}
			});
			var b = $(this).html();
			$(this).parents("select").find("option:contains('" + $.trim(d) + "')").after(b);
			$(this).remove()
		});
		$("#Move_Forum").find('option:contains("#"),option:contains("' + SUBF.smb + '")').map(function() {
			$(this).html($(this).html().replace(/#/, ""))
		})
	};
	movePostsForm.div = $('<div />');
	var d = document.URL.replace(/^.*\?fid=(\d+).*$/mg, "$1");
	var b = document.URL.replace(/^.*&tid=(\d+).*$/mg, "$1");
	var c = "/moderate.php?fid=" + d + "&tid=" + b;
	var e = '<style>.pun-modal.move_posts_form .modal-inner{width:72.4em;max-height:unset}.pun-modal.move_posts_form h2{max-width:100%}.move_posts_form .modal-inner>.container{padding:0!important;max-height:70vh}.punbb #move_posts_form .formal>form.container{width:100%!important;position:relative;border:none!important;padding-left:0!important;padding-right:0!important}.move_posts_form fieldset{margin-left:1.8em;margin-right:1.8em}#move_posts_form table.container thead{display:block}#move_posts_form table.container tbody{overflow-y:auto;overflow-x:hidden;display:block;max-height:16em;width:100%}#move_posts_form thead tr,#move_posts_form tbody tr{width:100%!important;display:table}.pgl,.forum_name{margin-bottom:.8em}.punbb #move_posts_form .formsubmit{padding:0 1.7em}#SubmitMPst{margin:0 1.8em}@media screen and (max-width:540px){#pun .move_posts_form fieldset{margin:.4em 1.2em!important}#pun .move_posts_form table.container tbody{max-height:12.6em}}</style><div id="move_posts_form" style="display:none"><div class="formal" id="movePostsTable"><form class="container" method="post" action="#$2#&mode=move"><fieldset style="display:none" id="PMove_3"><legend><span>' + _('Введите URL адрес темы, в которую необходимо перенести выбранные сообщения') + '</span></legend><div class="fs-box"><input type="hidden" name="posts" value="0" /><p><input type="text" size="80" maxlength="100" name="new_tid" /></p></div></fieldset><p class="formsubmit"><input type="button" id="SubmitMPst" class="button" value="' + _('Переместить') + '" /></p></form></div></div>'.replace("#$2#", c);
 
	$("form:last").after(e);
	var i = $("#move_posts_form form");
	i.find("fieldset:last").before('<fieldset id="PMove_1"><legend><span>' + _('Выберите форум или введите ключевое слово') + '</span></legend><div class="fs-box"></div></fieldset>');
	i.find("fieldset:last").before('<fieldset id="PMove_2" style="display:none"><legend><span>' + _('Выберите тему для переноса') + '</span></legend><div class="fs-box"></div></fieldset>');
	$("#PMove_1 .fs-box").append('<select id="Move_Forum"><option value="0">|-- ' + _('Форумы') + '</option></select>    <input type="text" size="30" maxlength="100" id="search-topics-move" placeholder="' + _('Поиск') + '"/>');
	$("#PMove_2 .fs-box").append('<div class="Select_Topics"><table class="container" cellspacing="0" style="padding:0"><tbody></tbody></table></div>');
	$(".Select_Topics").find("table").prepend('<thead><th class="tcl">' + _('Тема') + '</th><th class="tc2">' + _('Выбрать') + '</th></thead>');
	i.find(".formsubmit .button").attr("disabled", "disabled");
	$.get("/", function(j) {
		$(j).find(".category").each(function() {
			var k = $(this).find("h2 span").text();
			if (k == "@Blogs") {
				return
			}
			var l = 'label="' + k + '"';
			if (k.indexOf("'") != -1) {
				l = 'label="' + k + '"'
			} else {
				if (k.indexOf('"') != -1) {
					l = "label='" + k + "'"
				}
			}
			$("#PMove_1 .fs-box select").append("<optgroup " + l + "></optgroup>");
			$(this).find("tbody tr").each(function() {

				var m = $(this).find(".tclcon h3 a").text();
				if (!m)
					return;
				var n = $(this).find(".tclcon h3 a").attr("href").split("?id=")[1];
				$("#PMove_1 select optgroup:last").append('<option value="' + n + '">' + m + "</option>")

				var subf = $(this).find(".tclcon .subforums a");
				if (subf.length > 0) {
					subf.each(function() {
						var subf_text = $(this).text();
						var subf_link = $(this).attr("href").split("?id=")[1];
						$("#PMove_1 select optgroup:last").append('<option value="' + subf_link + '">&nbsp;&nbsp; ' + subf_text + "</option>")
					})

				}

			})
		});
		movePostsForm.div.mybbModal({
			content: $("#move_posts_form").show(),
			theme: 'move_posts_form',
			title: _('Перенести сообщения'),
			escClose: true,
			onclose: function() {
				setTimeout(function() {
					$('.move_posts_form .modal-inner.moved').remove();
					$('.move_posts_form .modal-inner:first').show();
				}, $.fn.mybbModal.defaults.animationDuration);
			},
			css: {
				marginTop: '5%'
			}
		});
		if (window.SUBF) h()
	});

	function g(j, i) {
		$.get(j, function(m) {
			$("#move_posts_form").find(".formsubmit .button").attr("disabled", "disabled");
			$("#PMove_2 table tbody tr,.pgl,.forum_name,.Select_Topics em").remove();
			$("#PMove_2").css("display", "block");
			if (!!i) {
				$('#Move_Forum option[value="0"]').attr("selected", "selected")
			} else {
				$("#search-topics-move").val("");
			}
			if (!$(m).find(".main tbody tr .tcr").length) {
				$(".Select_Topics").find("table").hide().before("<em>" + _("Не найдено ни одной темы") + ".</em>");
				return false;
			} else {
				$(".Select_Topics").find("table").show();
			}
			$(m).find(".main .forum tbody tr").each(function() {
				var p = $(this).find(".tcl a:first").text();
				p = p.replace(/(?:‡|†|¤)(?:.*?)(?:¤|&a?m?p?;?)/mgi, "");
				var o = $(this).find(".tcl a:first").attr("href").split("id=")[1];
				var n = '<tr><td class="tcl">' + p + '</td><td class="tc2"><input class="slctps" type="radio" value="' + o + '"' + (o == L ? ' disabled="disabled"' : '') + '/></td></tr>';
				$("#PMove_2").find(".Select_Topics tbody").append(n);
			});
			$(".Select_Topics tbody").scrollTop(0);
			var k = $(m).find(".linkst .pagelink").html();
			var l = $(m).find(".main h1>span").text();
			$("#PMove_2 table").before('<div class="forum_name"><strong style="font-size:1.1em">' + (!i ? _('Форум') + ': ' + l : l + ' ' + _('по запросу') + ' "' + i + '"') + "</strong></div>");
			if (!!k && (k.indexOf("«") != -1 || k.indexOf("»") != -1)) {
				$("#PMove_2 table").before('<div class="pgl">' + k + "</div>")
			}
		})
	}
	$("#PMove_1 select").live("change", function() {
		var j = $(this).find("option:selected").attr("value");
		if (j == "0") {
			return false
		}
		$(".formsubmit .button").attr("disabled", "disabled");
		var k = "/viewforum.php?id=" + j;
		g(k)
	});
	$(".pgl a").live("click", function(j) {
		j.preventDefault();
		var k = $(this).attr("href"),
			i = "";
		if (k.indexOf("search.php") != -1) i = $.trim($("#search-topics-move").val());
		$("#move_posts_form").find(".formsubmit .button").attr("disabled", "disabled");
		g(k, i)
	});
	$("#search-topics-move").live("input", function(e) {
		var t, j = $.trim($(this).val());
		if (j.length < 2) return;
		var k = '/search.php?action=search&keywords=' + encodeURIwin1251(j) + '&search_in=-1&sort_by=0&sort_dir=DESC&show_as=topics';
		clearTimeout(t);
		t = setTimeout(function() {
			g(k, j);
		}, 600);
	});
	$(".slctps").live("click", function() {
		$(".slctps").removeAttr("checked");
		$(this).attr("checked", "checked");
		$("#move_posts_form").find(".formsubmit .button").removeAttr("disabled")
	});
	movePostsForm.close = function(e, a) {
		e.preventDefault();
		$(a).parents('.pun-modal').find('.modal-bg').click();
	};
	var a = '<div class="modal-inner section moved"><h2><span>' + _('Уведомление') + '</span> <span class="closer" title="' + _('Закрыть') + '" onclick="movePostsForm.close(event,this)">'+String.fromCharCode(215)+'</span></h1><div id="afterMove"><div class="container moved_success"><strong>' + _('Сообщения перемещены') + '!</strong><br/>' + _('Перейти в тему') + ' <a href="#$3#" class=topic_link>#$4#</a> ' + _('или') + ' <a href="#" onclick="movePostsForm.close(event,this)" class=back_link>' + _('выбрать еще сообщения для переноса') + '.</a></div></div></div>';
	$("input#SubmitMPst").live("click", function() {
		if ($(this).attr("disabled")) {
			return false
		}
		$(this).attr("disabled", "disabled");
		var m = $("#PMove_2 .tc2").find("input:checked").attr("value");
		var l = "//" + location.hostname + "/viewtopic.php?id=" + m;
		var j = $("#PMove_2 .tc2").find("input:checked").parent().prev("td").text();
		if (m) {
			$('.move_posts_form input[name="new_tid"]').val(l)
		}
		$.ajax({
			url: c + "&mode=move",
			type: "POST",
			data: $(".move_posts_form form").serialize() + "&move_posts_comply=1",
			success: function(res) {
				$(".formsubmit .button").removeAttr("disabled");
				if ($(res).find("#pun-redirect,#pun-viewtopic").length) {
					a = a.replace("#$3#", l).replace("#$4#", j);
					$(".move_posts_form").find(".modal-inner:first").hide().after(a);
					$("#move_posts_form").find("input:checked").removeAttr("checked");
					var m = $('input[type="hidden"][name="posts"]').prop("value");
					if (m) {
						m = m.split(",")
					}
					for (var k = 0; k < m.length; k++) {
						$("#p" + m[k]).remove()
					}
					$(".modmenu input:checkbox").prop("checked", !1);
					var o = +$(".pagelink strong:last").text() - 1;
					var p = (!$(".post").length && !$(".pagelink .next").length && !!o) ? document.URL.replace(/(&p=)\d+/, '$1' + o) : document.URL;
					if ($(".pagelink .next").length || (!!o && p != document.URL)) {
						$.get(p, function(d) {
							var s = "";
							$(d).find(".post").map(function() {
								if (!$("#" + this.id).length) s += this.outerHTML
							});
							$(".topic").append(s);
							var e = $(d).find(".pagelink:first").html();
							$(".pagelink").html(e)
						})
					}
				} else if ($(res).find("#pun-message").length) {
					alert($.trim($(res).find(".info .container").text()));
				}
			},
			error: function() {
				alert(_("Произошла ошибка. Попробуйте повторить действие позднее."));
				$(".formsubmit .button").removeAttr("disabled");
			}
		});
	});
	$('input[name="move_posts"]').on("click", function(k) {
		k.preventDefault();
		if ($(".pl-select input:checkbox:checked").length == 0) {
			alert(_("Не выбраны сообщения для переноса."));
			return false
		} else {
			movePostsForm.div.click();
			var j = [];
			$(".pl-select").find("input:checkbox:checked").each(function() {
				var l = $(this).prop("name").replace(/^.*\[(\d+)\].*$/g, "$1");
				j.push(l)
			});
			j = j.join(",");
			$('input[type="hidden"][name="posts"]').prop("value", j)
		}
	});
});