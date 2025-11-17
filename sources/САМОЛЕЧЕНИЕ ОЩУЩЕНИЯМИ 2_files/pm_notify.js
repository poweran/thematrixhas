/****************************************************
 * Notification system for PM
 * Authors: Romych, Alex_63
 * Date: 17.05.2016 / 27.12.2024
****************************************************/

FORUM.isDifferentHostname = false;
try {
	self.document.location.hostname == top.document.location.hostname
} catch (e) {
	FORUM.isDifferentHostname = true
}
if (self == top || self.parent == top && FORUM.isDifferentHostname) {
	delete FORUM.isDifferentHostname;
	if (GroupID != 3) {
		(function() {
			if (!FORUM.pmNotify_close) FORUM.pmNotify_close = function() {};
			var lang_obj = {
				'вкл.' : {en: 'on'},
				'Включить уведомления о новых сообщениях' : {en: 'Enable notifications for new messages'},
				'Громкость звука' : {en: 'Volume of sound'},
				'Нет непрочитанных сообщений' : {en: 'No unread messages'},
				'У Вас новое сообщение от' : {en: 'You have a new message from'},
				'Отметить сообщения как прочтённые' : {en: 'Mark messages as read'},
				'Ссылка на сообщение' : {en: 'Jump to message'},
				'Новые сообщения' : {en: 'New messages'},
				'Привет' : {en: 'Welcome'},
				'Отмена' : {en: 'Cancel'},
				'Автор' : {en: 'Author'},
				'Развернуть' : {en: 'Expand'}
			}, lang = $('html')[0].lang;
			function _(text) {
				return (lang == 'ru' || !(lang_obj[text] && lang_obj[text][lang])) ? text : lang_obj[text][lang]
			}
			function d() {
				/*==|||==;
				#profile fieldset {
					clear: right;
				}
				.jGrowl .messag_theme {
					font-size: 10px !important;
					background: rgba(0,0,0,.75);
					padding: 0;
					box-shadow: 0 0 10px rgba(0,0,0,.3);
					font-family: Tahoma;
					width: 240px;
					min-height: 0 !important;
					opacity: 1 !important;
					padding: 0 !important;
				}
				.styl1 {
					border-radius: 5px 5px 0 0;
					font-size: 1.25em;
					padding: .5em 1em .5em 1em;
					font-weight: 400;
				}
				.styl1.sv {
					border-radius: 5px !important;
				}
				.styl2 {
					padding: 5px;
					margin-top: -16px;
					text-align: center;
					border-radius: 0 0 5px 5px;
				}
				.messag_theme .jGrowl-close {
					font-size: 18px !important;
					margin-top: 3px;
					margin-right: 2px;
					font-family: Arial,Helvetica,Sans-serif;
					padding: 1px 6px;
				}
				#closet {
					border-radius: 4px;
					border: solid 1px #fff;
					font-family: Arial;
					color: #fff;
					cursor: pointer;
					font-size: 11px;
					padding: 2px 5px;
					background: transparent;
					transition: .2s ease;
					margin-top: -8px;
				}
				#closet:hover {
					cursor: pointer;
					opacity: .5;
				}
				table#messages-list {
					margin-bottom: 6px;
					position: relative;
					width: 100%;
				}
				#messanger1 a img {
					float: left;
					box-shadow: 0 0 5px rgba(255,255,255,.25);
					border: solid 1px #808386 !important;
				}
				#messages-list a.mess {
					font-size: 11px;
					color: #fff;
				}
				#messages-list a.mess:hover {
					text-decoration: none;
				}
				span.num_msg {
					position: absolute;
					margin-top: -15px;
					margin-left: -8px;
					font-size: 11px;
					font-weight: 700;
					background: red;
					padding: 1px 4px;
					border-radius: 2px;
					height: 14px;
					color: #fff;
					cursor: pointer;
				}
				span.num_msg:before {
					content: " ";
					display: inline-block;
					position: absolute;
					width: 5px;
					height: 5px;
					transform: rotate(45deg);
					top: 14px;
					background: red;
					margin-left: 1px;
				}
				@media screen and (max-width:540px) {
					#pun-navlinks li#navpm span.num_msg {
						font-size: 15px !important;
						height: 18px;
						line-height: 20px !important;
					}

					.num_msg:before {
						top: 18px !important;
					};
				}
				#messages-list a.mess[onclick] {
					margin-top: 7px;
					display: inline-block;
					text-decoration: none;
					font: normal normal 400 11px/11px Tahoma;
					padding: 0 7px 2px 7px;
					border-radius: 4px;
					background: rgba(255,255,255,.9) !important;
					color: #000;
					font-size: 11px;
					position: relative;
					z-index: 10;
					margin-left: -4px;
					word-wrap: break-word;
					max-width: 160px;
				}
				#messages-list a.mess[onclick]:hover {
					text-decoration: underline;
				}
				#messages-list a>img.atr {
					margin: 5px 0 auto 6px !important;
				}
				#messages-list a.mess[onclick]:after {
					display: inline-block;
					position: absolute;
					z-index: -4;
					top: auto;
					left: 0;
					bottom: -6px;
					transform: rotate(-15deg);
					-webkit-transform: rotate(-15deg);
					opacity: .9;
					content: "";
					width: 16px;
					height: 8px;
					background: url(#$2#/i/add_images.png) 0 0 no-repeat;
				}
				#messages-list a.Author {
					display: inline-block;
					position: relative;
					z-index: 100;
					font: normal normal 700 11px/normal Tahoma;
					text-shadow: 1px 1px 0 #000;
					color: #cbd1d1;
					margin: 4px auto -1px -5px;
				}
				#messages-list td {
					vertical-align: top;
				}
				#volume-set {
					float: right;
				}
				#volSlider {
					width: 100px;
					height: 5px;
					display: inline-block;
					background: #fafafa;
					border: solid 1px #ccc;
					border-radius: 3px;
					box-shadow: inset 0 0 4px rgba(0,0,0,.15);
					float: right;
					margin-top: 5px;
					margin-left: 1em;
				}
				#volSlider .before {
					height: 5px;
					border: solid 1px transparent;
					margin-top: -1px;
					border-radius: 3px 0 0 3px;
					background: rgba(51,51,51,0.3);
					width: 0;
				}
				#volSlider .thumb {
					display: inline-block;
					position: relative;
					width: 10px;
					height: 10px;
					background: #a4a6a9;
					border-radius: 50%;
					top: -.9em;
					left: 0;
					box-shadow: inset 0 0 4px rgba(0,0,0,.4),0 0 5px rgba(0,0,0,.5);
					cursor: pointer;
				}
				@media screen and (max-width:540px) {
					#OnOff_Notify:before {
						content: "#$1#";
						position: absolute;
						margin-top: 10px;
						margin-left: -3px;
					}

					#OnOff_Notify+label {
						width: 0;
						color: transparent;
						font-size: 0;
					}

					#OnOff_Notify {
						float: right !important;
						margin-left: 20px;
						margin-right: 10px;
					};
				}
				==|||==;*/
			}
			d = "<style>" + (d.toString().split("==|||==;")[1].replace(/#\$2#/gm, StaticURL).replace('#$1#', _("вкл."))) + "</style>";
			$(d).appendTo("head");

			function b() {
				var h = localStorage.getItem("PMsettings_" + UserID);
				if (!h) {
					var i = JSON.parse($.ajax({
						url: "/api.php?method=storage.get&key=pmsettings",
						async: false,
						cache: false
					}).responseText);
					if (i && i.response) {
						h = i.response.storage.data.pmsettings
					} else {
						h = "1,60"
					}
					localStorage.setItem("PMsettings_" + UserID, h)
				}
				return h.split(",")
			}
			var g = b();
			var f = g[1],
				c = (parseInt(f) / 100),
				a = parseInt(g[0]);
			$(document).pun_mainReady(function() {
				if ($("#pun-messages #profile").length) {
					var i = '<div id="notify-settings" style="margin-bottom:1.1em;"><span class="inp2"><input type="checkbox" id="OnOff_Notify" style="float:left"/>' +
					'<label for="OnOff_Notify">&nbsp;' + _('Включить уведомления о новых сообщениях') + '</label><div id="volume-set">' + _('Громкость звука') + ': <div id="volSlider" class="vol_slider">' +
					'<div class="before"></div><div class="thumb"></div></div>';
					$("#profile>.container").prepend(i);
					var T = $("#volSlider")[0];
					var N = $("#volSlider > .thumb")[0];
					var W = $("#volSlider > .before")[0];
					var j = $("#volSlider").width();
					var h = N.offsetWidth;
					var k = parseInt($("#volSlider").css("padding-left"));
					var U = $("#OnOff_Notify");
					var V = parseInt(c * (j - h));
					N.style.left = V + "px";
					W.style.width = V + "px";
					U.prop("checked", !!a);

					function D(s) {
						var n = U.prop("checked"),
							r = 1;
						if (!n) {
							r = 0
						}
						r += ",";
						r += s;
						localStorage.setItem("PMsettings_" + UserID, r)
					}

					function R(r) {
						var n = r.getBoundingClientRect();
						return {
							top: n.top + pageYOffset,
							left: n.left + pageXOffset
						}
					}
					$(N).on('mousedown touchstart',function(t) {
						var n = R(N);
						var pageX = ( t.type=='mousedown' ? t.pageX : t.originalEvent ? t.originalEvent.touches[0].pageX : t.touches[0].pageX );
						var s = pageX - n.left;
						var r = R(T);
						r.left += k;
						document.onmousemove = document.ontouchmove = function(x) {
							var pageX = ( x.type=='mousemove' ? x.pageX : x.originalEvent ? x.originalEvent.touches[0].pageX : x.touches[0].pageX );
							var w = pageX - s - r.left;
							if (w < 0)
								w = 0;
							var v = j - h;
							if (w > v)
								w = v;
							var u = parseInt((w / (j - h)) * 100);
							N.style.left = w + "px";
							W.style.width = w + "px";
							D(u);
						};
						document.onmouseup = document.ontouchend = function() {
							document.onmousemove = document.onmouseup = document.ontouchend = document.ontouchmove = null;
						};
						return false
					});
					N.onmouseup = function() {
						var n = localStorage.getItem("PMsettings_" + UserID);
						$.post("/api.php", {
							method: "storage.set",
							token: ForumAPITicket,
							key: "pmsettings",
							value: n
						}, "json")
					};
					N.ondragstart = function() {
						return false
					};
					$("#OnOff_Notify,#OnOff_Notify+label").live("click", function() {
						var t = U.prop("checked"),
							n = b(),
							r = n[1],
							s;
						if (t) {
							s = "1," + r
						} else {
							s = "0," + r
						}
						$.post("/api.php", {
							method: "storage.set",
							token: ForumAPITicket,
							key: "pmsettings",
							value: s
						}, "json");
						localStorage.setItem("PMsettings_" + UserID, s)
					})
				}
				if ($("#navpm span").attr("data-last-unread")) {
					(function() {
						var u = $("#navpm span").html().match(/\((\d+)\)$/)[1];
						$("#navpm span").html($("#navpm span").html().replace(/(\s|&nbsp;?)\((\d+)\)/mg, ""));
						var v = 7;
						var t = parseInt($("#navpm>a:first").css("padding-right").replace(/(px|em?)/, ""));
						var r = parseInt($("#navpm>a:first").css("margin-right").replace(/(px|em?)/, ""));
						if (r > 0) {
							t += r
						}
						if (t != 0) {
							v = t - 1
						}
						var s = '<span class="num_msg" style="margin-left:-' + v + 'px" onclick="location.href=\'/messages.php\';">' + u + "</span>";
						$(s).appendTo("#navpm")
					})()
				}
				if (a == 0) return
				var L = '<audio id="sound1" preload="auto">';
				var m = new Audio();
				var Z = StaticURL;
				var eS = false;
				var l = (!!m.canPlayType && m.canPlayType("audio/mp3") != "");
				L += l ? '<source type="audio/mpeg" src="' + Z + '/media/notice.mp3">' : '<source type="audio/ogg; codecs=vorbis" src="' + Z + '/media/notice.ogg">';
				L += "</audio>";
				var M, O = [],
					J, I, q, K, p, Q, H, E;
				if (!$("#navpm .num_msg").length)
					localStorage.removeItem("myNewPm" + UserID);
				if ($("#navpm .num_msg").length && document.URL.indexOf("messages.php") == -1) {
					var o = $("#navpm a span").attr("data-last-unread");
					var o2 = localStorage.getItem("myNewPm" + UserID);
					var o3 = localStorage.getItem("myNewPm_noShow" + UserID);
					if (o3 && parseInt(o) > parseInt(o2))
						localStorage.removeItem("myNewPm_noShow" + UserID);
					if (o2 && parseInt(o) <= parseInt(o2) && o3)
						return true;
					var G = '<h2 class="styl1 sv" style="cursor:pointer" title="' + _('Развернуть') + '">' + _('Новые сообщения') + '</h2>';
					$.jGrowl('<div id="messanger1">' + G + "</div>", {
						sticky: !0,
						theme: "messag_theme"
					});
					$(".messag_theme .jGrowl-close").live("mousedown touchdown", function() {
						if ($(this).attr("data-hide"))
							localStorage.setItem("myNewPm_noShow" + UserID, "true")
					}).live("mouseenter", function() {
						$(this).attr("data-hide", "1")
					}).live("mouseleave", function() {
						$(this).removeAttr("data-hide");
					});

					function P(n) {
						if (!n)
							$("body").append(L);
						$.ajax({
							type: "GET",
							url: "/messages.php?show=unread",
							contentType: "text/html",
							success: function(r) {
								Q = $(r).find("#messages").attr("action").split("&code=")[1];
								if ($(r).find("tr.icon").length == 0) {
									$("#messanger1").html("<h2 class='styl1' style='border-radius:5px!important'>" + _('Нет непрочитанных сообщений') + "</h2>");
									setTimeout(function() {
										FORUM.pmNotify_allRead(true)
									}, 2000);
									return
								}
								$("#messanger1").html('<h2 class="styl1"><span>' + _('Привет') + ', <strong>' + UserLogin + '</strong><br /></span>' +
								'<span>' + _("У Вас новое сообщение от") + ':</span></h2><div class="styl2" style="display:none"><table id="messages-list"></table>' +
								'<br /><button id="closet" class="styl3" title="' + _('Отметить сообщения как прочтённые') + '" onclick="FORUM.pmNotify_allRead()">&nbsp;' + _('Отмена') + '&nbsp;</button></div>');
								$(r).find("tr.icon:lt(5)").each(function() {
									J = $(this).find(".tclcon a").text();
									if (J.length > 40)
										J = J.substr(0, 40) + "..."
									I = $(this).find(".tclcon a").attr("href");
									q = $(this).find(".tc2 a").text().replace(/"/gim, "&#34;");
									K = $(this).find(".tc2 a").attr("href");
									M = K.split("?id=")[1];
									if ($.inArray(M, O) === -1)
										O.push(M);
									p = '<tr><td style="text-align:left;width:40px"><a target="_blank" class="mess" href="' + K + '" style="text-decoration:none;"' +
									' title="' + q + '"><img class="atr" style="border:1px solid #696969;border-radius: 9em;margin: 3px 0 -2px 5px;" width="28" height="28"' +
									' alt="' + q + '" src="' + StaticURL + '/i/blank.gif"></a></td><td style="text-align:left;padding-left:6px"><a class="mess" target="_blank" onclick="FORUM.pmNotify_close()" ' +
									'href="' + I + '" title="' + _('Ссылка на сообщение') + '">' + J + '</a><br /><a class="Author" target="_blank" href="' + K + '" title="' + _('Автор') + '">' + q + "</a></td></tr>";
									$("#messages-list").append(p)
								});
								var N = $("#sound1"), T = 200;
								if (!N.length) { 
									T = 2000;
								}
								setTimeout(function() {
									if (eS) return;
									eS = true;
									N[0].volume = c;
									N[0].play()
								}, T);
								$.getJSON("/api.php?method=users.get&user_id=" + O + "&fields=avatar,username", function(w) {
									var x = w.response.users;
									for (var v in x) {
										var t = x[v];
										var u = t.avatar;
										if (!u) 
											u = StaticURL + "/i/default_avatar.jpg";
										else {
											var _j = new Image();
											_j.src = u;
											_j.data = t.username.replace(/"/gim, "&#34;");
											_j.onload = function() {
												if (this.height > this.width)
													$('.atr[alt="' + this.data + '"]').css("background-size", "100% auto");
											}
										}
										$('.atr[alt="' + t.username + '"]').css({
											"background-image": "url('" + u + "')",
											"background-size": "auto 100%",
											"background-position": "center center"
										})
									}
								});
								if (n) {
									$(".styl2>*").css({
										visibility: "hidden"
									});
									$("#messanger1").addClass("toggle");
									$(".styl2").hide().slideDown(400, function() {
										$(".styl2>*").hide().css({
											visibility: "visible"
										}).fadeIn(300)
									})
								} else {
									$(".styl2").show()
								}
							}
						})
					}
					$(".styl1.sv").live("mouseenter", function(n) {
						clearTimeout(H);
						clearTimeout(E);
						H = setTimeout(function() {
							P(true)
						}, 230)
					});
					$(".styl1.sv,#messanger1.toggle").live("mouseleave", function() {
						clearTimeout(H);
						clearTimeout(E);
						E = setTimeout(function() {
							$(".styl2").slideUp(300, function() {
								$("#messanger1").html(G).removeClass("toggle")
							})
						}, 1500)
					});
					$("#messanger1.toggle").live("mouseenter", function() {
						clearTimeout(E)
					});
					var y = localStorage.getItem("myNewPm" + UserID)
					if ((y && parseInt(y) < parseInt(o)) || !y)
						P(false);
					localStorage.setItem("myNewPm" + UserID, o);
					FORUM.pmNotify_close = function() {
						$(".messag_theme .jGrowl-close").trigger("click")
					};
					FORUM.pmNotify_allRead = function(x) {
						localStorage.removeItem("myNewPm" + UserID);
						if (!x)
							$.post("/messages.php?box=0&p=1&code=" + Q + "&action=markread");
						$("#navpm .num_msg").remove();
						FORUM.pmNotify_close()
					}
				}
			})
		})()
	}
};