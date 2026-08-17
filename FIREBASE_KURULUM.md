# Firebase ve GitHub Pages kurulumu

Online odaların çalışması için bir defaya mahsus şu ayarlar yapılmalıdır:

1. Firebase Console'da Web uygulaması oluşturun.
2. **Authentication > Sign-in method** bölümünde **Anonymous (Anonim)** oturum açmayı etkinleştirin.
3. Realtime Database oluşturun. Web yapılandırma değerlerini `firebase-config.js` dosyasına girin.
4. Realtime Database > Rules alanına `firebase.rules.json` içindeki `rules` nesnesini yapıştırıp yayımlayın. Yeni kurallar öğretmene oda kontrolü, öğrenciye yalnızca kendi canlı durumunu yazma yetkisi verir.
5. Projeyi GitHub'a gönderin ve **Settings > Pages** bölümünde `main` dalını yayımlayın.

PWA kurulumu ve Service Worker yalnızca HTTPS veya `localhost` üzerinde çalışır. `index.html` dosyasını doğrudan açmak çevrimdışı oyunu gösterir; PWA kurulumu ve Firebase modülleri için yerel sunucu kullanılmalıdır.

Öğretmen PIN'i, ana sayfadaki Yönetim Paneli > Genel Ayarlar bölümünden değiştirilir. Oda oluşturulduktan sonra öğretmen aktif soru kümesinden yarışmada kullanılacak harfleri ve süreyi seçer. Başlangıç zamanı Firebase sunucu zaman damgası olarak bütün öğrencilere gönderilir.
