/* Большая Палитра © Deff */
if ((document.URL.indexOf("viewtopic.php?")!=-1)||(document.URL.indexOf("edit.php")!=-1)
||(document.URL.indexOf("post.php")!=-1)){
var L0='<img src="http://savepic.net/844049.gif" style="width:0;display:none;"/>';
var L="<style>#color-area{background:#A09D9D url(http://savepic.net/844049.gif) 100% 0 no-repeat;padding-bottom:8px!important;padding-left: 35px !important;}#color-area table{width: 286px;}table.Myp,table.Myp td,#len-tbl-01,#len-tbl-01 td{ text-align:left;vertical-align:top;padding:0!important;margin:0!important;border-collapse:collapse!important;}span.hidds{display:block;width:18px;height:18px;background:url(http://savepic.net/829713.png) 50% 50% no-repeat;margin: 2px 28px -2px -28px;}#len-tbl-01{margin: 1px 21px 12px 0!important; width:276px!important;height:98px!important;}#len-tbl-01 td{height:11px;padding:0!important;width:11px!important;background-image:url(http://savepic.net/711220.gif);background-position:50% 50%; background-repeat: no-repeat;background-image: none;border: #fff 1px solid!important;}#len-tbl-01 td:hover {background-image:url(http://savepic.net/686931.gif)!important;background-position:50% 50%; background-repeat:no-repeat;}#len-tbl-01{table-layout:fixed;width:276px!important;height:96px!important;}table.Myp{width:280px!important;}table.Myp td,table.Myp tr{height:18px!important;vertical-align:text-bottom;margin:0!important; border: none 0 transparent!important;border-collapse:collapse!important;}td.rightMy,td.murom{text-align:left!important;width:66px!important;}#name_1,#name_0{margin:0;posizion:absolute;z-index:2000;font-size:11px!important;background-color:#fff!important;border: #000 1px solid;width:58px!important;}#name_1{border: red 1px solid!important;font-size:11px;color:#761A21;}#name_0{font-size:11px;color:#000!important;}#len-tbl-01img {position:absolute!important;border: #000 1px none;}#len-tbl-01 img.Nul_Img{position:absolute!important;height:11px!important;width:11px!important;margin:0!important;}#len-tbl-01 .metka{position:absolute!important;z-index:100;margin:-1px 0 0 -1px!important;height:13px;width:13px;}#color-area table[cellspacing] td img{height:14px!important;}#color-area table[cellspacing]{width:276px!important;height:17px!important;}</style>"
$("#html-header").prepend(L0);document.write(L);
$(document).ready(function() {
ColorArray=new Array(
"EEEEEE","DDDDDD","CCCCCC","BBBBBB","AAAAAA","999999","888888","777777","666666","555555",
"444444","333333","222222","111111","000000","FC0000","ED0000","DB0000","CB0000","BA0000",
"AA0000","980000","880000", //2строка-->
"FEFD65","FEFD33","FCFC00","CAFEFE","CAFECA","CBFE99","CAFE65","CBFE33","CAFC00","99FEFE",
"99FECA","99FE99","98FE65","99FE33","98FC00","65FEFE","65FECA","65FE98","65FE65","66FE33",
"65FC00","33FEFE","33FECB", //3строка-->
"FECA65","FECB33","FCCA00","CACAFE","CBCBCB","CACA98","CBCA66","CACA32","CBCA00","99CBFE",
"98CACA","98CA98","99CB66","98CA32","99CB00","65CAFE","66CBCB","66CB98","66CB66","65CA32",
"66CB00","33CBFE","32CACA", //4строка-->
"FE9865","FE9833","FC9800","CA99FE","CA98CA","CA9898","CB9866","CA9832","CB9900","9999FE",
"9898CA","979797","989865","999833","989700","6598FE","6699CB","659898","659865","669933",
"659800","3399FE","3298CA", //5строка-->
"FE6565","FE6533","FC6500","CA65FE","CB66CA","CB6698","CB6666","CA6532","CB6500","9865FE",
"9866CB","986598","986565","996533","986500","6565FE","6666CB","656598","666666","656532",
"666500","3366FE","3265CA", //6строка-->
"FE3365","FE3333","FC3200","CA33FE","CA32CA","CA3298","CA3265","CA3232","CB3200","9833FE",
"9832CA","993398","993365","993333","983200","6533FE","6532CA","653399","653265","653232",
"663200","3333FE","3232CA", //7строка-->
"FC0065","FC0032","FC0000","CA00FC","CB00CA","CB0098","CB0065","CB0032","CB0000","9800FC",
"9800CB","980097","980065","980032","980000","6500FC","6500CB","650098","660065","660032",
"660000","3200FC","3200CB", //8строка-->
"00FC00","00ED00","00DB00","00CB00","00BA00","00AA00","009800","008800","007600","006600",
"005400","004400","003200","002200","001000","0000FC","0000ED","0000DB","0000CB","0000BA",
"0000AA","000098","000088" )//End

var Metka_link="http://savepic.net/696986.gif";
var Nul_Img_link="http://savepic.net/711220.gif";
var stat_marker_link="http://savepic.net/668540.png";
var nul_img='<img class="Nul_Img" src="'+Nul_Img_link+'" alt="s" />';
var metka='<img class="metka" src="'+Metka_link+'"/>'; //alert(metka)


var i=0,j=0,tbl="";var tblz="";
var Ntd=23,Nstr=8;
var TDstrStart='<td style="background-color:#';
var TDstrEnd='">'+nul_img;

for(j=0; j<Nstr; j++){tbl='<tr>'+tbl;
   for (i=0; i<Ntd; i++){NumTd=Ntd*j+i;tbl+=TDstrStart+ColorArray[NumTd]+';" alt="#'+ColorArray[NumTd]+TDstrEnd+'</td>'};
tbl+="</tr>";tblz+=tbl;tbl="";};tbl='<table id="len-tbl-01"'+tblz+'</table>';//alert(tbl)
$("#color-area").prepend(tbl);

$("#color-area").removeAttr("onclick")
$("#len-tbl-01").before('<table class="Myp"><tr><td class=murom><input id="name_1" name="_1" type="text" size="7" value="######"></td><td></td><td class="rightMy"><input id="name_0" name="_0" type="text" size="7" value="######"></td></tr></table>');$("#color-area").append('<span title="свернуть" class=hidds alt=hidds></span>')

 $("#len-tbl-01 td").mouseover(function(){
  $("#name_1").css({"color":"#000"});
    $("#name_1").val($(this).attr("alt"));
});

$("#len-tbl-01 td").click(function (){ // Клик по ячейке - ввод BB- кода и..
   $("#len-tbl-01 .metka").remove();$(this).append(metka);
    $(this).css({"background-image":"url("+stat_marker_link+")"});
       var ss=$(this).attr("alt");$("#name_0").val(ss);ss='[color='+ss;ss+="]";
       	 bbcode(ss,"[/color]");});

 $("#main-reply,.hidds").click(function (){ // cворачивание #color-area по клику на поле ввода
 $("#color-area").hide(); });
});
}