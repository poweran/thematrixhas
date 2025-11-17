/****************************************************
 * Number of unread topics in each forum
 * Author: Alex_63
 * Date: 19.06.2017 / 29.05.2023
****************************************************/

$(document).pun_mainReady(function() {
	if (!($('#pun-index,#pun-viewforum:has(.isub)').length && $('.main tr.inew').length))
		return;

	function style() { /*==|||==;
.icon[data-new-topics]:before,
.subforums span[data-new-topics]:before {
	background: #ff0000;
	border-radius: 8px;
	color: #fff;
	content: attr(data-new-topics);
	display: inline-block;
	font-size: .8em;
	font-weight: 700;
	height: 12px;
	line-height: 12px;
	margin: -6px;
	min-width: 12px;
	padding: 2px;
	position: absolute;
	text-align: center;
}
.subforums span[data-new-topics]:before {
	font-size: .7em;
	margin-left: -16px;
	margin-top: 0;
	padding: 1px;
}
	==|||==;*/ };
	$('<style>' + (style.toString().split('==|||==;')[1]) + '</style>').appendTo('head');

	var objFID = {};

	function tstNew() {
		if (Object.keys(objFID).length == 0)
			$.post('/misc.php?action=markread', function() {
				$('.inew').removeClass('inew');
				if (window.SUBF)
					$('.subforums .Icon_LastPost').removeClass('N').addClass('O').find('img').attr('src', SUBF.icon_old)
			});
		$('.main tr.inew').each(function() {
			var thisID; if ($(this).is('[id]')) thisID = parseInt($(this).attr('id').substr(7));
		if (objFID[thisID]) $(this).find('.icon').attr('data-new-topics', objFID[thisID])
		});
		if (window.SUBF)
			$('.subforums span .Icon_LastPost.N').parent().each(function() {
				var sfID = parseInt($(this).attr('class').substr(2));
				if (objFID[sfID]) $(this).attr('data-new-topics', objFID[sfID]);
			});
	};

	function getNumTopics(data) {
		$(data).find('tr.inew').each(function() {
			var id = $(this).find('.tc2 a').attr('href').split('id=')[1], numNew;
			if (typeof number_unread_sub == 'undefined' && $(this).hasClass('isub')) {
				id_parent = $(this).data('parent');
				if (!isNaN(+id_parent))
					id_parent = parseInt(id_parent);
				numNew = objFID[id_parent];
				if (numNew) objFID[id_parent] = numNew + 1;
				else objFID[id_parent] = 1
			}
			if (!isNaN(+id))
				id = parseInt(id);
			numNew = objFID[id];
			if (numNew) objFID[id] = numNew + 1;
			else objFID[id] = 1
		});
		if ($(data).find('.pagelink:first a.next').length)
			$.get($(data).find('.pagelink:first a.next').attr('href') + '&nohead', getNumTopics);
		else tstNew()
	};

	$.get('/search.php?action=show_new&nohead', getNumTopics);
});