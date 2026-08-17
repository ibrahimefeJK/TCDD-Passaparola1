(function (global) {
  'use strict';
  var rows = [
    ['A', 'İstasyonda veya trende yolcu ve personele sesli bilgi verilmesine ne ad verilir?', 'Anons'],
    ['B', 'Demiryolu üstyapısında traverslerin altında bulunan kırmataş tabakasına ne ad verilir?', 'Balast'],
    ['C', 'Lokomotifin veya motorlu demiryolu aracının çekiş gücüyle ilgili kullanılan kısa terim nedir?', 'Cer'],
    ['Ç', 'Bir trenin hareketini sağlayan lokomotif veya motorlu tren setlerinin genel sınıfı nedir?', 'Çeken araç'],
    ['D', 'Tekerlek çiftini bir arada tutan ve yükün aktarılmasında görev yapan mile ne ad verilir?', 'Dingil'],
    ['E', 'Demiryolu hattının elektrik enerjisiyle beslenmesi için kurulan sisteme ne ad verilir?', 'Elektrifikasyon'],
    ['F', 'Bir demiryolu aracının hızını azaltmak veya aracı durdurmak için kullanılan sisteme ne ad verilir?', 'Fren'],
    ['G', 'Yolcu ve tren hizmetlerinin yürütüldüğü büyük istasyon yapısına ne ad verilir?', 'Gar'],
    ['H', 'Karayolu ile demiryolunun aynı seviyede kesiştiği geçide ne ad verilir?', 'Hemzemin geçit'],
    ['I', 'Sinyal ve ikaz sistemlerinde görülebilen, görsel uyarı sağlayan temel unsur nedir?', 'Işık'],
    ['İ', 'Trenlerin durabildiği, yolcu veya yük işlemlerinin yapılabildiği demiryolu tesisine ne ad verilir?', 'İstasyon'],
    ['J', 'Mekanik enerjiyi elektrik enerjisine dönüştüren cihaza ne ad verilir?', 'Jeneratör'],
    ['K', 'Elektrikli trenlere üstten enerji sağlayan havai hat sistemine ne ad verilir?', 'Katener'],
    ['L', 'Vagonları çekmek veya itmek için kullanılan motorlu demiryolu aracına ne ad verilir?', 'Lokomotif'],
    ['M', 'Trenin bir hattan başka bir hatta geçmesini sağlayan ray düzenine ne ad verilir?', 'Makas'],
    ['N', 'Elektrikli demiryollarında iki besleme bölgesi arasında enerjisiz bırakılan katener kesimine ne ad verilir?', 'Nötr bölge'],
    ['O', 'Hat kesimlerinde trenlerin güvenli aralıklarla takip edilmesini sağlayan sistemlerden birine ne ad verilir?', 'Otomatik blok'],
    ['Ö', 'Bir ana sinyalin durumunu önceden haber vermek amacıyla kullanılan sinyale ne ad verilir?', 'Ön sinyal'],
    ['P', 'Yolcuların trene binip indiği, istasyonlarda ray boyunca uzanan alana ne ad verilir?', 'Peron'],
    ['R', 'Demiryolu araçlarının üzerinde hareket ettiği çelik yol elemanına ne ad verilir?', 'Ray'],
    ['S', 'Tren hareketlerini renk, ışık veya işaretlerle düzenleyen emniyet unsuruna ne ad verilir?', 'Sinyal'],
    ['Ş', 'Ray devresi gibi elektriksel uygulamalarda iki noktayı düşük dirençle birbirine bağlayan bağlantıya ne ad verilir?', 'Şönt'],
    ['T', 'Rayları belirli aralıkta tutan ve yükü balasta aktaran enine yol elemanına ne ad verilir?', 'Travers'],
    ['U', 'İnsan veya yükün bir yerden başka bir yere taşınması faaliyetinin genel adı nedir?', 'Ulaştırma'],
    ['Ü', 'Karayolu veya yaya yolunun demiryolunun üzerinden geçirilmesiyle oluşturulan yapıya ne ad verilir?', 'Üst geçit'],
    ['V', 'Lokomotif tarafından çekilen veya tren dizisinde yük ya da yolcu taşımaya yarayan araca ne ad verilir?', 'Vagon'],
    ['Y', 'Demiryolunda ray, travers, balast ve ilgili altyapının birlikte oluşturduğu güzergâha verilen kısa ad nedir?', 'Yol'],
    ['Z', 'Trenlerin planlanan hareket saatlerini gösteren programa genel olarak ne ad verilir?', 'Zaman çizelgesi']
  ];
  global.PassaparolaDefaults = {
    letters: rows.map(function (row) { return row[0]; }),
    questions: rows.map(function (row) {
      return { id: row[0], letter: row[0], question: row[1], acceptedAnswers: [row[2]], enabled: true, selected: true };
    }),
    settings: {
      title: 'TCDD EĞİTİM MERKEZİ', subtitle: 'PASSAPAROLA YARIŞMASI',
      durationSeconds: 240, lastThirtyWarning: true, adminPin: '1234'
    }
  };
})(window);
