/*************************
 mybb.ru, 
 кнопка BB-цитата
 30.03.2016; v2.3; под jQ 1.7.2
 Author: Deff
*************************/

(function(){
function RasPars(context){
var arrTAG =[
'p','','\n',
'br','','\n',
'table','','',
'strong','[b]','[/b]',
'em.bbuline','[u]','[/u]',
'span[style^="color"]','[color=###]','[/color]',
'span[style^="font-family"]','[font=###]','[/font]',
'span[style^="font-size"]','[size=###]','[/size]',
'span[style^="font-style"]','[i\]','[/i]',
'span[style^="font-style"]','[i\]','[/i\]',
'span[style*="text-align: left"]','[align=left]','[/align]',
'span[style*="text-align: center"]','[align=center]','[/align]',
'span[style*="text-align: right"]','[align=right]','[/align]',
'a[href]','[url=###]','[/url]',
'iframe','[video]###','[/video]',
'img.postimg','[img]###','[/img]',
'.code-box','[code]','[/code]',
'.quote-box.spoiler-box','','[/spoiler]',
'.quote-box:not(.spoiler-box)','','[/quote]'
];
function replacer2(str, p1, offset, s){
   return str=p1;
}
function replacer(str, p1,offset, s){
   p1 = p1.replace(/style="([^"]*)"/img,replacer2).replace(/;/g,' ')
   .replace(/:/g,'=').replace(/"/g,'').replace('background-color','bgcolor');
 return str=('['+p1+']');
}
var lng = arrTAG.length;
for(var i=0;i<lng;i+=3){
 context.find(arrTAG[i]).each(function(){
    var attr = arrTAG[i+1];
    if(arrTAG[i].indexOf('table')!=-1 ){
       var attr=$(this).clone().wrap('<div></div>').parent().html().replace(/<tbody>|<\/tbody>/gim,'').replace(/<((?:table|tr|td)[^>]*)>/gim, replacer );
      attr=attr.replace(/<(\/(?:table|tr|td))>/gim, '[$1]' );
       $(this).html('');
    }
    if($(this).attr('class')=='code-box'){
       $(this).html($(this).find('.blockcode > .scrollbox > pre').html());
    }
    if($(this).attr('class')=='quote-box'||$(this).attr('class')=='quote-box with-avatar'){
       var that0 = $(this);
       function tstQuote(that){
         var opis=that.find('blockquote:first').prev('cite').text();
         if(!!opis){opis=opis.split(' написал')[0];attr='[quote="'+opis+'"]';}
         if(!opis)attr='[quote]'; 
         return that.find('blockquote:first').html();
       } 
       $(this).html(tstQuote(that0));that0 = $(this);var attr0=attr;
       function tstQ2(){
       that0.find('.quote-box:not(.spoiler-box):last').each(function(){
         var a=tstQuote($(this));$(this).replaceWith(attr+ a +arrTAG[i+2]);tstQ2();
       });}tstQ2();attr=attr0;
    }
    if($(this).attr('class').indexOf(' spoiler')!=-1 ){
       var that0 = $(this);
       function tstSpoiler(that){
          var opis=that.find('div:first[onclick*=".toggleClass"]').html();
          attr='[spoiler="'+$.trim(opis)+'"]';
          if(opis=='')attr='[spoiler]'; 
          return that.find('blockquote:first').html();
       } 
       $(this).html(tstSpoiler(that0));that0 = $(this);var attr0=attr;
       function tstSP2(){
       that0.find('.spoiler-box:last').each(function(){
         var a = tstSpoiler($(this)); $(this).replaceWith(attr+a+arrTAG[i+2]);tstSP2()
       });}tstSP2();attr=attr0;
    }
    if(arrTAG[i].indexOf('style')!=-1 && attr.indexOf('###')!=-1){
       var txAttr=$(this).attrr('style').split(':')[1].replace(/px|;/g,'');
       attr=attr.replace('###',$.trim(txAttr))
    }
    if(arrTAG[i].indexOf('href')!=-1 ){
       var txAttr=$(this).attr('href').split('click.php?')[1];
       attr=attr.replace('###',$.trim(txAttr))
    }
    if(arrTAG[i].indexOf('iframe')!=-1 ){
       var txAttr=$(this).attr('src');
       attr=attr.replace('###',$.trim(txAttr))
    }
    if(arrTAG[i].indexOf('img.postimg')!=-1 ){
       var txAttr=$(this).attr('src');
       attr=attr.replace('###',$.trim(txAttr))
    }
    if(arrTAG[i]=='p'){
       $(this).html($(this).html().replace(/\s*<br[^<>]*>\s*$/,''));
    }
    $(this).replaceWith(attr+ $(this).html()+arrTAG[i+2]);
     
 });
}
  return $.trim(context.text());
}

window.MyfuncBB_tagCopy = function (sel){
 $.fn.attrr = $.fn.attr;
 if(typeof($.fn.prop)!='undefined'){ $.fn.attr=$.fn.prop;}
 var context = $(sel).parents('.post').find('.post-content').clone();
 context.find('p.lastedit,dl.post-sig').remove();
 context.html(context.html().replace(/\s+(?=<p|<div)/img,''))

 var autor = $(sel).parents('.post').find('li.pa-author a');
 autor.find('span.acchide,img').remove();autor=autor.text(); 
 var link ='http://'+location.hostname+'/viewtopic.php?pid=';
 var numPost = $(sel).parents('.post').find('h3:first a:last').attr('href').split('#p')[1];
 link+=numPost+'#p'+numPost; 
 insert('[quote='+autor+']'+RasPars(context)+'[/quote]');
 $.fn.attr=$.fn.attrr;
}

function testFunc(sel){
 if($('#main-reply').length)return false;
 return true;
}

var trueDislocation = $("#pun-viewtopic")
if(trueDislocation.length){
$(".post",trueDislocation).each(function(){
 if(typeof(UserID)=='undefined'&& testFunc(this))return false;
 $(this).find('.pl-quote').after('<li class="pl-BBquote" style=""><a href="#" onclick="MyfuncBB_tagCopy(this);return false;">BB-цитата</a></li>')
});
}

}())