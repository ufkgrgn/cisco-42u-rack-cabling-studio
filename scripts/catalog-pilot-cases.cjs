// Reviewed against the two manufacturer-backed models in catalog-source-pack.js.
// Each TR/EN pair is a separate query. Expanding the catalog requires new ground truth.
const c='eng-cisco-c9200l-24p-4g',a='eng-aruba-jl677a';
const pairs=[
 ['exact','C9200L-24P-4G','C9200L-24P-4G',[c]],['exact','Cisco C9200L-24P-4G','Cisco C9200L-24P-4G',[c]],['exact','JL677A','JL677A',[a]],['exact','Aruba JL677A','Aruba JL677A',[a]],
 ['exact','c9200l-24p-4g','c9200l-24p-4g',[c]],['exact','jl677a','jl677a',[a]],['exact','C9200L-24P-4G modeli','model C9200L-24P-4G',[c]],['exact','JL677A anahtar','JL677A switch',[a]],
 ['technical','24 port gigabit PoE anahtar','24 port gigabit PoE switch',[c,a]],['technical','370 watt PoE bütçesi','370 watt PoE budget',[c,a]],['technical','30 watt port başına PoE','30 watt PoE per port',[c,a]],
 ['technical','4 adet 10 gigabit uplink','four 10 gigabit uplinks',[a]],['technical','4 adet 1 gigabit SFP uplink','four 1 gigabit SFP uplinks',[c]],['technical','1U 24 bakır port','1U 24 copper ports',[c,a]],
 ['technical','SFP+ uplinkli Aruba','Aruba with SFP+ uplinks',[a]],['technical','Cisco 1G uplink','Cisco 1G uplink',[c]],['technical','802.3at PoE anahtar','802.3at PoE switch',[c,a]],
 ['technical','24 PoE port ve 4 uplink','24 PoE ports and four uplinks',[c,a]],['technical','Aruba 24 port PoE','Aruba 24 port PoE',[a]],['technical','Cisco 24 port PoE','Cisco 24 port PoE',[c]],
 ['no-match','48 bakır port','48 copper ports',[]],['no-match','100 gigabit uplink','100 gigabit uplink',[]],['no-match','800 watt PoE','800 watt PoE',[]],['no-match','2U yönlendirici','2U router',[]],
 ['no-match','doğrulanmış 50 watt giriş tüketimi','verified 50 watt input consumption',[]],['no-match','24 port pasif panel','24 port passive patch panel',[]],
 ['noise','masaüstü yazıcı','desktop printer',[]],['noise','kahve makinesi','coffee machine',[]],['noise','12 volt kamera','12 volt camera',[]],['noise','bilinmeyen ZZZ999 modeli','unknown ZZZ999 model',[]]
];
module.exports=pairs.flatMap(([category,tr,en,expected],i)=>[{id:`tr-${i+1}`,language:'tr',category,query:tr,expected},{id:`en-${i+1}`,language:'en',category,query:en,expected}]);
