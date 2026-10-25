window.LEVELS = [
  {
    id: "foundation",
    name: "Foundation",
    tag: "Start with small words",
    icon: "sprout",
    color: "sage",
    description: "Pehle chhote words. Phir badi jeet.",
  },
  {
    id: "basic",
    name: "Basic",
    tag: "Words around you",
    icon: "sun",
    color: "peach",
    description: "Roz ki duniya, English mein.",
  },
  {
    id: "beginner",
    name: "Beginner",
    tag: "Your first sentences",
    icon: "book",
    color: "lavender",
    description: "Words ko jodo. Sentence padho.",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    tag: "Connect your ideas",
    icon: "compass",
    color: "blue",
    description: "Questions, actions aur chhoti baatein.",
  },
  {
    id: "advanced",
    name: "Advanced",
    tag: "Little stories, big ideas",
    icon: "flag",
    color: "rose",
    description: "Chhoti stories padho aur samjho.",
  },
];
// Hand-prepared curriculum: English target, Hindi explanation, Roman Hindi, distractors, typing target.
const PACKS = [
  [
    "foundation",
    "Your first words",
    "School",
    "bag|बैग / बस्ता|basta|पानी;सूरज,pen|कलम|kalam|बिल्ली;घर,book|किताब|kitab|दूध;खेल,desk|मेज़|mez|पेड़;जूता",
  ],
  [
    "foundation",
    "Hello, little animals",
    "Animals",
    "cat|बिल्ली|billi|कुत्ता;पक्षी,dog|कुत्ता|kutta|मछली;बिल्ली,hen|मुर्गी|murgi|गाय;घोड़ा,cow|गाय|gaay|चूहा;शेर",
  ],
  [
    "foundation",
    "A day outside",
    "Nature",
    "sun|सूरज|suraj|चाँद;बारिश,sky|आसमान|aasman|नदी;पेड़,tree|पेड़|ped|फूल;पत्थर,rain|बारिश|baarish|धूप;हवा",
  ],
  [
    "foundation",
    "Ready, set, go!",
    "Actions",
    "run|दौड़ना|daudna|बैठना;सोना,sit|बैठना|baithna|दौड़ना;खाना,eat|खाना|khana|पीना;चलना,read|पढ़ना|padhna|खेलना;सोना",
  ],
  [
    "basic",
    "At home",
    "Home",
    "water|पानी|paani|दूध;रोटी,food|भोजन / खाना|khana|किताब;कमरा,door|दरवाज़ा|darwaza|खिड़की;कुर्सी,chair|कुर्सी|kursi|मेज़;बिस्तर",
  ],
  [
    "basic",
    "School essentials",
    "School",
    "pencil|पेंसिल|pencil|रबड़;बस्ता,teacher|शिक्षक / अध्यापक|shikshak|दोस्त;खिलाड़ी,school|विद्यालय / स्कूल|school|घर;बाज़ार,friend|दोस्त|dost|भाई;अध्यापक",
  ],
  [
    "basic",
    "How do you feel?",
    "Feelings",
    "happy|खुश|khush|उदास;थका हुआ,sad|उदास|udaas|खुश;भूखा,tired|थका हुआ|thaka hua|प्यासा;खुश,kind|दयालु|dayalu|नाराज़;तेज़",
  ],
  [
    "basic",
    "Time to play",
    "Play",
    "ball|गेंद|gend|बल्ला;जूता,bat|बल्ला|balla|गेंद;पेड़,team|दल / टीम|team|पानी;किताब,play|खेलना|khelna|पढ़ना;सोना",
  ],
  [
    "beginner",
    "My school bag",
    "School",
    "This is my bag.|यह मेरा बैग है।|Yeh mera bag hai|यह तुम्हारा बैग है।;वह मेरा घर है।|bag,I have a book.|मेरे पास एक किताब है।|Mere paas ek kitab hai|मेरे पास एक गेंद है।;मैं किताब पढ़ता हूँ।|book,This is a pen.|यह एक कलम है।|Yeh ek kalam hai|यह एक मेज़ है।;वह एक पेड़ है।|pen,My bag is blue.|मेरा बैग नीला है।|Mera bag neela hai|मेरा बैग लाल है।;मेरा घर नीला है।|blue",
  ],
  [
    "beginner",
    "Meet my family",
    "Home",
    "This is my home.|यह मेरा घर है।|Yeh mera ghar hai|यह मेरा स्कूल है।;वह एक दुकान है।|home,My brother is kind.|मेरा भाई दयालु है।|Mera bhai dayalu hai|मेरी बहन खुश है।;मेरा भाई थका है।|brother,I love my family.|मैं अपने परिवार से प्यार करता हूँ।|Main apne parivaar se pyar karta hoon|मैं स्कूल जाता हूँ।;मुझे खेलना पसंद है।|family,We eat together.|हम साथ खाना खाते हैं।|Hum saath khana khate hain|हम साथ खेलते हैं।;हम साथ पढ़ते हैं।|together",
  ],
  [
    "beginner",
    "Let us play",
    "Play",
    "I like cricket.|मुझे क्रिकेट पसंद है।|Mujhe cricket pasand hai|मुझे दूध पसंद है।;मैं क्रिकेट देखता हूँ।|cricket,This is my ball.|यह मेरी गेंद है।|Yeh meri gend hai|यह मेरा बल्ला है।;वह तुम्हारी गेंद है।|ball,We play outside.|हम बाहर खेलते हैं।|Hum bahar khelte hain|हम अंदर पढ़ते हैं।;हम घर जाते हैं।|outside,I can run fast.|मैं तेज़ दौड़ सकता हूँ।|Main tez daud sakta hoon|मैं धीरे चलता हूँ।;मैं तेज़ पढ़ता हूँ।|fast",
  ],
  [
    "beginner",
    "My everyday world",
    "Nature",
    "The sun is hot.|सूरज गर्म है।|Suraj garam hai|पानी ठंडा है।;आसमान नीला है।|hot,The tree is green.|पेड़ हरा है।|Ped hara hai|फूल लाल है।;पेड़ छोटा है।|green,I drink water.|मैं पानी पीता हूँ।|Main paani peeta hoon|मैं खाना खाता हूँ।;मैं दूध पीता हूँ।|water,The sky is blue.|आसमान नीला है।|Aasman neela hai|आसमान काला है।;नदी नीली है।|sky",
  ],
  [
    "intermediate",
    "Ask a question",
    "School",
    "Where is your book?|तुम्हारी किताब कहाँ है?|Tumhari kitab kahan hai|तुम्हारा नाम क्या है?;तुम्हारी गेंद कहाँ है?|where,Can you help me?|क्या तुम मेरी मदद कर सकते हो?|Kya tum meri madad kar sakte ho|क्या तुम खेल सकते हो?;क्या मैं घर जा सकता हूँ?|help,May I come in?|क्या मैं अंदर आ सकता हूँ?|Kya main andar aa sakta hoon|क्या मैं बाहर जा सकता हूँ?;क्या मैं पानी पी सकता हूँ?|come,What is your name?|तुम्हारा नाम क्या है?|Tumhara naam kya hai|तुम कहाँ रहते हो?;तुम्हारी उम्र क्या है?|name",
  ],
  [
    "intermediate",
    "My daily routine",
    "Home",
    "I brush my teeth every morning.|मैं हर सुबह अपने दाँत साफ करता हूँ।|Main har subah apne daant saaf karta hoon|मैं हर रात किताब पढ़ता हूँ।;मैं सुबह खेलता हूँ।|morning,I wash my hands before eating.|मैं खाने से पहले हाथ धोता हूँ।|Main khane se pehle haath dhota hoon|मैं खाने के बाद सोता हूँ।;मैं पानी पीता हूँ।|before,I go to school with my friend.|मैं अपने दोस्त के साथ स्कूल जाता हूँ।|Main apne dost ke saath school jata hoon|मैं अकेला घर जाता हूँ।;मैं अपने भाई के साथ खेलता हूँ।|friend,I read a book before bed.|मैं सोने से पहले किताब पढ़ता हूँ।|Main sone se pehle kitab padhta hoon|मैं सुबह खाना खाता हूँ।;मैं सोने से पहले खेलता हूँ।|read",
  ],
  [
    "intermediate",
    "A good teammate",
    "Play",
    "We take turns to bat.|हम बारी-बारी से बल्लेबाज़ी करते हैं।|Hum baari baari se ballebaazi karte hain|हम साथ खाना खाते हैं।;हम गेंद ढूँढते हैं।|turns,Please pass me the ball.|कृपया मुझे गेंद दो।|Kripya mujhe gend do|कृपया मुझे किताब दो।;कृपया दरवाज़ा खोलो।|pass,Our team plays well together.|हमारी टीम साथ मिलकर अच्छा खेलती है।|Hamari team saath milkar achha khelti hai|हमारी टीम आज नहीं खेलती।;हमारा स्कूल बड़ा है।|team,We help each other.|हम एक-दूसरे की मदद करते हैं।|Hum ek doosre ki madad karte hain|हम एक-दूसरे से दौड़ते हैं।;हम स्कूल जाते हैं।|help",
  ],
  [
    "intermediate",
    "Notice the world",
    "Nature",
    "It is raining outside today.|आज बाहर बारिश हो रही है।|Aaj bahar baarish ho rahi hai|आज बाहर धूप है।;कल बारिश हुई थी।|raining,The bird is sitting on a tree.|पक्षी पेड़ पर बैठा है।|Pakshi ped par baitha hai|बिल्ली मेज़ पर बैठी है।;पक्षी आसमान में उड़ रहा है।|bird,We should keep our park clean.|हमें अपना पार्क साफ रखना चाहिए।|Humein apna park saaf rakhna chahiye|हमें पार्क में सोना चाहिए।;हमें पेड़ काटने चाहिए।|clean,Plants need water and sunlight.|पौधों को पानी और धूप चाहिए।|Paudhon ko paani aur dhoop chahiye|पौधों को दूध चाहिए।;पक्षियों को पानी चाहिए।|plants",
  ],
  [
    "advanced",
    "The missing pencil",
    "School",
    "Ravi could not find his pencil.|रवि को अपनी पेंसिल नहीं मिल रही थी।|Ravi ko apni pencil nahi mil rahi thi|रवि को अपनी किताब मिल गई।;रवि ने पेंसिल खरीदी।|find,He looked under his desk.|उसने अपनी मेज़ के नीचे देखा।|Usne apni mez ke neeche dekha|उसने दरवाज़े के बाहर देखा।;वह मेज़ पर बैठा।|under,His friend found it near the door.|उसके दोस्त को वह दरवाज़े के पास मिली।|Uske dost ko woh darwaze ke paas mili|उसे वह घर में मिली।;उसके भाई ने दरवाज़ा खोला।|near,Ravi thanked his friend for helping.|रवि ने मदद के लिए अपने दोस्त को धन्यवाद दिया।|Ravi ne madad ke liye apne dost ko dhanyavaad diya|रवि ने अपने दोस्त से पेंसिल माँगी।;रवि ने अपने भाई को बुलाया।|thanked",
  ],
  [
    "advanced",
    "A rainy afternoon",
    "Nature",
    "Dark clouds covered the sky.|काले बादलों ने आसमान ढक लिया।|Kaale badalon ne aasman dhak liya|आसमान में सूरज चमक रहा था।;पेड़ों पर पक्षी बैठे थे।|clouds,Meera ran home before the rain.|मीरा बारिश से पहले घर दौड़ी।|Meera baarish se pehle ghar daudi|मीरा बारिश में स्कूल गई।;मीरा घर में सो रही थी।|before,She watched the rain from her window.|उसने अपनी खिड़की से बारिश देखी।|Usne apni khidki se baarish dekhi|उसने दरवाज़े से धूप देखी।;वह बारिश में खेली।|window,After the rain a rainbow appeared.|बारिश के बाद इंद्रधनुष दिखाई दिया।|Baarish ke baad indradhanush dikhai diya|बारिश से पहले अँधेरा हुआ।;बारिश के बाद बर्फ पड़ी।|rainbow",
  ],
  [
    "advanced",
    "Our cricket match",
    "Play",
    "Our team practised every evening.|हमारी टीम हर शाम अभ्यास करती थी।|Hamari team har shaam abhyaas karti thi|हमारी टीम हर सुबह सोती थी।;हमारा स्कूल शाम को खुलता था।|practised,At first we missed many catches.|शुरू में हमने कई कैच छोड़े।|Shuru mein humne kai catch chhode|शुरू में हमने मैच जीत लिया।;हमने कई किताबें पढ़ीं।|missed,We kept trying and improved together.|हम कोशिश करते रहे और साथ बेहतर हुए।|Hum koshish karte rahe aur saath behtar hue|हमने कोशिश करना छोड़ दिया।;हम अकेले घर चले गए।|trying,Everyone felt proud of the team.|सबको टीम पर गर्व हुआ।|Sabko team par garv hua|सब टीम से नाराज़ हुए।;सबको भूख लगी।|proud",
  ],
  [
    "advanced",
    "A small act of kindness",
    "Home",
    "A tired dog sat outside our house.|एक थका हुआ कुत्ता हमारे घर के बाहर बैठा था।|Ek thaka hua kutta hamare ghar ke bahar baitha tha|एक बिल्ली घर के अंदर सो रही थी।;एक कुत्ता पार्क में दौड़ रहा था।|tired,I asked my brother to bring water.|मैंने अपने भाई से पानी लाने को कहा।|Maine apne bhai se paani lane ko kaha|मैंने अपनी बहन से खाना माँगा।;मैंने अपने दोस्त को बुलाया।|bring,We put a bowl of water near the gate.|हमने फाटक के पास पानी का कटोरा रखा।|Humne phatak ke paas paani ka katora rakha|हमने मेज़ पर किताब रखी।;हमने दरवाज़ा बंद किया।|bowl,The dog drank and rested in the shade.|कुत्ते ने पानी पिया और छाया में आराम किया।|Kutte ne paani piya aur chhaya mein aaram kiya|कुत्ता धूप में दौड़ता रहा।;बिल्ली ने दूध पिया।|shade",
  ],
];
window.LESSONS = PACKS.map((p, n) => ({
  id: "lesson-" + n,
  level: p[0],
  title: p[1],
  topic: p[2],
  items: p[3].split(",").map((row, i) => {
    const [text, hi, roman, wrong, target] = row.split("|");
    return {
      id: `w-${n}-${i}`,
      text,
      hi,
      roman,
      wrong: wrong.split(";"),
      target: target || text,
    };
  }),
}));
