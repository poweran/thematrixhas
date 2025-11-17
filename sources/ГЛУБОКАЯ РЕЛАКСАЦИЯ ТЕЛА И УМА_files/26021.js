/*************************
 mybb.ru, 
 Перенос формы Быстрого ответа под сообщение 
 19.09.2015; v1.7;
 Author: Alex_63
*************************/

if($('#pun-viewtopic').length) { 
  var prevElem = $('#post-form').prev();
  $('.post').hover(function(){ 
    $('.post').removeClass('selected');
    $(this).addClass('selected'); 
  });
  function MReplyForm(){ 
    $('#post-form').find('script').remove(); 
    $('#post-form').insertAfter('.post.selected'); 
    $('.button.cancel').show(); 
  };
  $('.post').each(function(){ 
    $(this).find('.pl-quote').after('<li class="pl-reply"><a href="#" onclick="MReplyForm(); return false;">Ответить</a></li>'); 
  });
  $('#post-form input[name="preview"]').each(function(){ 
    $(this).after('<input style="margin-left:4px;" class="button cancel" type="reset" value="Отмена" />'); });
  $('.button.cancel').click(function(){ 
    $('#post-form').insertAfter(prevElem); 
    $(this).hide(); 
  });
  $('#Bubble span, .pa-author a').click(MReplyForm);
  $('li.pl-quote>a').each(function(){ 
    $(this).attr('onClick','MReplyForm()'); 
  });
};