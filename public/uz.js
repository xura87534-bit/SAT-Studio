/* SAT Studio interface language. Uzbek is the default; English is one tap away.

   The app's screens are written in English. When the language is Uzbek, this file translates the
   interface text as each screen is drawn: D holds whole phrases, P holds phrases with numbers in them.
   Anything not listed here simply stays in English, so a missing line is never an error.

   Left in English on purpose: SAT questions, answer choices, passages and explanations (the exam is in
   English), SAT skill names, and the test-taking screen itself, which mirrors the real Bluebook screen. */
(function () {
"use strict";
let lang = "uz";
try { const s = localStorage.getItem("satstudio_lang"); if (s === "en" || s === "uz") lang = s; } catch (e) { }
window.SAT_LANG = lang;
window.SAT_SETLANG = function (l) { try { localStorage.setItem("satstudio_lang", l === "en" ? "en" : "uz"); } catch (e) { } location.reload(); };
/* UZ("o'zbekcha", "English") for text written in both languages at the source. */
window.UZ = (uz, en) => (lang === "en" ? en : uz);
if (lang !== "uz") return;
try { document.documentElement.lang = "uz"; } catch (e) { }

const D = {
  // ----- menu and sidebar
  "Home": "Bosh sahifa", "90-Day Course": "90 kunlik kurs", "Course": "Kurs", "Quick Practice": "Tezkor mashq", "Quick": "Tezkor",
  "Math": "Matematika", "Reading & Writing": "O‘qish va yozish", "Word bank": "Lug‘at", "Words": "Lug‘at", "Book Tests": "Kitob testlari", "Book": "Kitob",
  "Feedback": "Tahlil", "Progress": "Natijalar", "History": "Tarix", "Students": "O‘quvchilar", "Pricing": "Narxlar", "Go Pro": "Pro olish", "Pro plan": "Pro tarif",
  "Built-in questions": "Tayyor savollar", "Claude connected": "Claude ulangan", "Syncing your progress…": "Natijalaringiz yuklanmoqda…",
  "Sign in or sign up free": "Kirish yoki bepul ro‘yxatdan o‘tish", "Sign out": "Chiqish", "Backup & sync": "Zaxira nusxa",
  // ----- home
  "Your level": "Darajangiz", "Take a full test to light up your level.": "Darajangizni bilish uchun to‘liq test ishlang.",
  "Find your starting scores.": "Boshlang‘ich ballingizni aniqlang.", "Keep the climb going.": "Shu zaylda davom eting.",
  "Each section has two adaptive modules, just like the real Digital SAT. Take one of each to get a total score.": "Har bir bo‘limda haqiqiy Digital SAT’dagidek ikkita moslashuvchan modul bor. Umumiy ballni bilish uchun ikkala bo‘limdan bittadan test ishlang.",
  "Warm up: 10 quick questions": "Boshlash: 10 ta tezkor savol", "Full SAT, Bluebook format": "To‘liq SAT, Bluebook formatida",
  "Start the course": "Kursni boshlash", "Continue": "Davom etish",
  "Tests completed": "Ishlangan testlar", "Best Math": "Eng yaxshi Matematika", "Best Reading & Writing": "Eng yaxshi O‘qish va yozish",
  "Questions answered": "Javob berilgan savollar", "Accuracy": "Aniqlik",
  "Recent tests": "So‘nggi testlar", "Your completed tests will show up here.": "Ishlagan testlaringiz shu yerda ko‘rinadi.",
  "Skills to work on": "Ishlash kerak bo‘lgan mavzular", "Skills you miss will be listed here, weakest first.": "Xato qilgan mavzularingiz shu yerda, eng zaifidan boshlab ko‘rsatiladi.",
  "See all": "Hammasi", "Mistakes to redo": "Qayta ishlanadigan xatolar", "Redo Math": "Matematikani qayta ishlash", "Redo R&W": "R&W’ni qayta ishlash",
  "Continue where you left off": "To‘xtagan joyingizdan davom eting", "Resume": "Davom etish", "Discard": "O‘chirish", "Options": "Sozlamalar",
  "Save your progress": "Natijalaringizni saqlang", "Create free account": "Bepul hisob ochish",
  "Your scores live only in this browser for now. A free account keeps them safe and syncs every device, and it switches on the Claude tutor. It takes ten seconds.": "Hozircha ballaringiz faqat shu brauzerda saqlanyapti. Bepul hisob ularni saqlab qoladi, barcha qurilmalarda ko‘rsatadi va Claude repetitorini yoqadi. Bu o‘n soniya oladi.",
  "Your scores live only in this browser for now. A free account keeps them safe and syncs every device. It takes ten seconds.": "Hozircha ballaringiz faqat shu brauzerda saqlanyapti. Bepul hisob ularni saqlab qoladi va barcha qurilmalarda ko‘rsatadi. Bu o‘n soniya oladi.",
  "Free plan": "Bepul tarif", "See Pro": "Pro’ni ko‘rish", "Review": "Ko‘rish", "Delete": "O‘chirish",
  // ----- tests library
  "All": "Hammasi", "Full tests": "To‘liq testlar", "Drills": "Mashqlar", "Book tests": "Kitob testlari", "Skill drills": "Mavzu bo‘yicha mashqlar",
  "both sections, one 1600 score": "ikkala bo‘lim, 1600 ballik bitta natija", "Full-length adaptive tests": "To‘liq moslashuvchan testlar",
  "Practice drills": "Mashqlar", "Domain drills": "Bo‘limlar bo‘yicha mashqlar", "Start": "Boshlash", "Pro": "Pro", "Back tomorrow": "Ertaga ochiladi",
  "Full tests follow the Digital SAT format: two 35-minute modules, with Module 2 adapting to Module 1. Drills target one area. You can save and exit any test and resume it later.": "To‘liq testlar Digital SAT formatida: 35 daqiqalik ikkita modul, 2-modul 1-moduldagi natijangizga moslashadi. Mashqlar bitta mavzuga qaratilgan. Istalgan testni saqlab chiqib, keyin davom ettirishingiz mumkin.",
  "Full tests follow the Digital SAT format: two 32-minute modules of 27 questions, each built on a short passage. Module 2 adapts to how you do in Module 1. You can save and exit any test and resume it later.": "To‘liq testlar Digital SAT formatida: 32 daqiqalik, 27 savoldan iborat ikkita modul, har bir savol qisqa matnga asoslangan. 2-modul 1-moduldagi natijangizga moslashadi. Istalgan testni saqlab chiqib, keyin davom ettirishingiz mumkin.",
  "Bluebook format: Reading and Writing (two 32-minute modules), a 10-minute break, then Math (two 35-minute modules). One score out of 1600.": "Bluebook formati: O‘qish va yozish (32 daqiqalik ikki modul), 10 daqiqa tanaffus, so‘ng Matematika (35 daqiqalik ikki modul). 1600 ballik bitta natija.",
  "A fixed Module 1 you can retake to measure growth. Module 2 adapts to you.": "1-modul o‘zgarmaydi, shuning uchun qayta ishlab o‘sishingizni o‘lchashingiz mumkin. 2-modul sizga moslashadi.",
  "A different fixed Module 1 with the same official domain balance.": "Boshqa savollardan iborat 1-modul, mavzular nisbati rasmiy testdagidek.",
  "A third fixed Module 1, slightly heavier on multi-step problems.": "Uchinchi 1-modul, ko‘p bosqichli masalalar biroz ko‘proq.",
  "Its own fixed Module 1 with the official domain balance. Module 2 adapts to you.": "O‘ziga xos 1-modul, mavzular nisbati rasmiy testdagidek. 2-modul sizga moslashadi.",
  "A fixed Module 1 covering all 11 question types. Retake it to measure growth. Module 2 adapts to you.": "Barcha 11 turdagi savolni qamrab olgan 1-modul. O‘sishingizni o‘lchash uchun qayta ishlang. 2-modul sizga moslashadi.",
  "Its own fixed Module 1 with the official mix of question types. Module 2 adapts to you.": "O‘ziga xos 1-modul, savol turlari rasmiy testdagidek. 2-modul sizga moslashadi.",
  "Its own fixed Module 1 built from the newest, harder passages. Module 2 adapts to you.": "Eng yangi va qiyinroq matnlardan tuzilgan 1-modul. 2-modul sizga moslashadi.",
  "Its own fixed Module 1 from the newest question set, written to match recent SAT difficulty. Module 2 adapts to you.": "Eng yangi savollar to‘plamidan tuzilgan, so‘nggi SAT qiyinligiga mos 1-modul. 2-modul sizga moslashadi.",
  "Challenge Test": "Qiyin test", "A Module 1 made of only medium and hard questions. Aim for the harder Module 2.": "Faqat o‘rta va qiyin savollardan iborat 1-modul. Maqsad: qiyinroq 2-modulga chiqish.",
  "Fresh mix": "Yangi savollar", "R&W Fresh mix": "R&W yangi savollar", "Module 1 is drawn from questions you haven't answered yet.": "1-modul siz hali ishlamagan savollardan tuziladi.",
  "Module 1 is drawn from passages you haven't seen yet.": "1-modul siz hali ko‘rmagan matnlardan tuziladi.",
  "AI-written test": "AI yozgan test", "R&W AI-written test": "R&W: AI yozgan test", "Claude writes both modules new, so no two attempts repeat.": "Claude ikkala modulni yangidan yozadi, shuning uchun testlar takrorlanmaydi.",
  "Claude writes new passages for both modules, so no two attempts repeat.": "Claude ikkala modul uchun yangi matnlar yozadi, shuning uchun testlar takrorlanmaydi.",
  "Needs Claude, available when opened in Claude": "Claude kerak (hozircha yoqilmagan)", "Finish any test first to unlock": "Ochish uchun avval biror test ishlang",
  "Redo my mistakes": "Xatolarimni qayta ishlash", "No mistakes to redo right now": "Hozircha qayta ishlanadigan xato yo‘q",
  "Every Math question you got wrong, oldest first. Answer one correctly and it leaves the list.": "Matematikadan xato qilgan barcha savollaringiz, eng eskisidan boshlab. To‘g‘ri javob bersangiz, savol ro‘yxatdan chiqadi.",
  "Every Reading and Writing question you got wrong, including Book Tests, oldest first. Answer one correctly and it leaves the list.": "O‘qish va yozishdan xato qilgan barcha savollaringiz, eng eskisidan boshlab. To‘g‘ri javob bersangiz, savol ro‘yxatdan chiqadi.",
  "Algebra drill": "Algebra mashqi", "Advanced Math drill": "Advanced Math mashqi", "Data Analysis drill": "Data Analysis mashqi", "Geometry & Trig drill": "Geometriya va trigonometriya mashqi",
  "Linear equations, functions, systems and inequalities.": "Chiziqli tenglamalar, funksiyalar, sistemalar va tengsizliklar.",
  "Quadratics, exponentials, equivalent expressions and nonlinear systems.": "Kvadrat va ko‘rsatkichli funksiyalar, teng kuchli ifodalar, chiziqsiz sistemalar.",
  "Ratios, percentages, statistics, probability and study design.": "Nisbatlar, foizlar, statistika, ehtimollik va tadqiqot tuzilishi.",
  "Triangles, circles, area, volume and trigonometric ratios.": "Uchburchaklar, aylanalar, yuza, hajm va trigonometrik nisbatlar.",
  "Extreme questions only": "Faqat eng qiyin savollar", "10 of the toughest questions across all four domains.": "To‘rtta bo‘limdan eng qiyin 10 ta savol.",
  "10 of the toughest Reading and Writing questions, starting with ones you haven't seen.": "O‘qish va yozishdan eng qiyin 10 ta savol, avval siz ko‘rmaganlari.",
  "Grid-in drill": "Javobni o‘zingiz yozadigan savollar", "10 student-produced response questions: no choices to lean on.": "Variantsiz 10 ta savol: javobni o‘zingiz yozasiz.",
  "Graphs, tables & figures": "Grafik, jadval va chizmalar", "10 questions built on graphs, scatterplots, tables, bar graphs, dot plots and geometric figures.": "Grafik, jadval, diagramma va geometrik chizmalarga asoslangan 10 ta savol.",
  "Algebra: graphs & tables": "Algebra: grafik va jadvallar", "Advanced Math: graphs & tables": "Advanced Math: grafik va jadvallar",
  "Lines, systems, inequalities and linear models shown as graphs, tables and shaded regions.": "Grafik, jadval va bo‘yalgan sohalarda berilgan to‘g‘ri chiziqlar, sistemalar va tengsizliklar.",
  "Parabolas, exponentials, absolute value and function tables to read and interpret.": "Parabola, ko‘rsatkichli funksiya, modul va funksiya jadvallarini o‘qish.",
  "Module 1 drill: beat the routing line": "1-modul mashqi: qiyin 2-modulga chiqing",
  "22 Module 1-style questions in 35 minutes. Score about 60% (weighted by difficulty) to earn the harder Module 2 on the real test.": "35 daqiqada 1-modul uslubidagi 22 ta savol. Haqiqiy testda qiyinroq 2-modulga chiqish uchun taxminan 60% to‘plang (qiyin savollar ko‘proq hisoblanadi).",
  "Algebra & Advanced Math mix": "Algebra va Advanced Math aralash", "22 questions from the two biggest domains, about 70% of the real test. 35 minutes.": "Eng katta ikki bo‘limdan 22 ta savol: haqiqiy testning 70% ga yaqini. 35 daqiqa.",
  "Weak-skill drill": "Zaif mavzular mashqi", "Claude writes 10 questions on the skills you miss most often.": "Claude siz eng ko‘p xato qiladigan mavzulardan 10 ta savol yozadi.",
  "Claude writes 10 Reading and Writing questions on the skills you miss most.": "Claude siz eng ko‘p xato qiladigan mavzulardan O‘qish va yozish bo‘yicha 10 ta savol yozadi.",
  "Craft and Structure drill": "Craft and Structure mashqi", "Information and Ideas drill": "Information and Ideas mashqi",
  "Standard English Conventions drill": "Standard English Conventions mashqi", "Expression of Ideas drill": "Expression of Ideas mashqi",
  "Words in context, text structure and purpose, and cross-text connections.": "Kontekstdagi so‘zlar, matn tuzilishi va maqsadi, matnlar orasidagi bog‘liqlik.",
  "Central ideas, textual and data evidence, and inferences.": "Asosiy g‘oya, matn va ma’lumotlardan dalil, xulosa chiqarish.",
  "Punctuation between clauses, agreement, verb forms, pronouns, and modifiers.": "Tinish belgilari, moslashuv, fe’l shakllari, olmoshlar va aniqlovchilar.",
  "Transitions and rhetorical synthesis from student notes.": "Bog‘lovchi so‘zlar va qaydlar asosida gap tuzish.",
  "Mark unknown words during tests to save them here with Uzbek translations": "Test paytida notanish so‘zlarni belgilang: ular o‘zbekcha tarjimasi bilan shu yerda saqlanadi",
  // ----- start sheet
  "Questions": "Savollar", "Format": "Format", "Time": "Vaqt", "Score": "Ball", "200 to 800 estimate": "200–800 oralig‘ida taxminiy ball",
  "Timed, like the real test": "Vaqt bilan, haqiqiy testdagidek", "Start test": "Testni boshlash", "Cancel": "Bekor qilish", "Start over": "Boshidan boshlash",
  "Use the Calculator button in the top bar for graphing. Use Save & exit anytime to come back later.": "Grafik chizish uchun yuqoridagi Calculator tugmasidan foydalaning. Keyinroq davom etish uchun istalgan payt Save & exit tugmasini bosing.",
  "Each question shows a short passage on the left and the question on the right. Use Save & exit anytime to come back later.": "Har bir savolda chapda qisqa matn, o‘ngda savol turadi. Keyinroq davom etish uchun istalgan payt Save & exit tugmasini bosing.",
  // ----- quick practice
  "Easy questions on the fundamentals that matter most. Wrong or unsure? You get the steps in 2–3 lines.": "Eng muhim asoslar bo‘yicha oson savollar. Xato qildingizmi yoki ishonchingiz komil emasmi? Yechim 2–3 qatorda ko‘rsatiladi.",
  "Start a round": "Mashqni boshlash", "Math + English": "Matematika + Ingliz tili", "English": "Ingliz tili",
  "10 questions, no timer. Your weakest skills come up most, so you spend time where it counts.": "10 ta savol, vaqt chegarasi yo‘q. Zaif mavzularingiz ko‘proq chiqadi, shunda vaqtingiz eng kerakli joyga ketadi.",
  "Start 10 questions": "10 ta savolni boshlash", "20 questions": "20 ta savol", "Where you need work": "Qaysi mavzular ustida ishlash kerak",
  "Based on your tests and your Quick Practice answers. Tap a skill to drill only that.": "Testlaringiz va Tezkor mashq javoblaringiz asosida. Faqat bitta mavzuni mashq qilish uchun uni bosing.",
  "Drill": "Mashq", "Fundamentals cheat sheet": "Asosiy qoidalar", "One line per idea. Open a skill to see its rule.": "Har bir qoida bir qatorda. Qoidani ko‘rish uchun mavzuni oching.",
  "← Quick Practice": "← Tezkor mashq", "See results": "Natijani ko‘rish", "No problem. Here is how:": "Hechqisi yo‘q. Yechimi:", "I don't know. Show me how": "Bilmayman. Yechimini ko‘rsating", "✓ Correct": "✓ To‘g‘ri", "Show the steps": "Yechimni ko‘rsatish",
  "Remember:": "Eslab qoling:", "Rule:": "Qoida:", "You'll see this skill again in a moment.": "Bu mavzu biroz keyin yana chiqadi.", "Next": "Keyingi", "Finish": "Tugatish",
  "Round done": "Mashq tugadi", "Another round": "Yana bir mashq", "Back": "Orqaga", "By skill": "Mavzular bo‘yicha",
  "Strong. These basics are solid.": "Zo‘r. Bu asoslarni yaxshi bilasiz.",
  // ----- results
  "Back to history": "Tarixga qaytish", "Module 1": "1-modul", "Module 2": "2-modul", "Module 2, harder": "2-modul, qiyinroq", "Module 2, lower": "2-modul, osonroq",
  "By domain": "Bo‘limlar bo‘yicha", "Why you missed points": "Nega ball yo‘qotdingiz", "Skills to learn": "O‘rganish kerak bo‘lgan mavzular", "Timing": "Vaqt",
  "Total time": "Umumiy vaqt", "Correct": "To‘g‘ri", "Missed": "Xato", "Biggest time sinks": "Eng ko‘p vaqt olgan savollar", "Your pacing is on track. Keep it up.": "Tezligingiz joyida. Shunday davom eting.",
  "Analysis and study plan": "Tahlil va o‘quv rejasi", "AI analysis is available when this page is open in Claude.": "AI tahlili Claude yoqilganda ishlaydi.",
  "Review questions": "Savollarni ko‘rib chiqish", "Show only missed": "Faqat xatolarni ko‘rsatish", "Timed": "Vaqt bilan", "Untimed": "Vaqtsiz", "Mode": "Rejim",
  "You'd earn the harder Module 2": "Siz qiyinroq 2-modulga chiqqan bo‘lardingiz", "Easy-question slips": "Oson savollardagi xatolar",
  "These are the cheapest points on the test. Slow down on the first questions and check each answer before moving on.": "Bular testdagi eng oson ballar. Dastlabki savollarda shoshilmang va keyingisiga o‘tishdan oldin javobingizni tekshiring.",
  "These are the cheapest points on the test. Write one line of work for each step, and plug your answer back in to check it.": "Bular testdagi eng oson ballar. Har bir bosqichni bir qatorda yozing va javobni o‘rniga qo‘yib tekshiring.",
  "These medium questions point to specific skills. Drill them, and use ASK to walk through the method.": "Bu o‘rta qiyinlikdagi savollar aniq mavzularni ko‘rsatadi. Ularni mashq qiling va yechim usulini ASK orqali so‘rang.",
  // ----- progress, history, feedback, words
  "Every completed test and drill in this section counts toward these numbers.": "Shu bo‘limda ishlangan har bir test va mashq bu raqamlarga kiradi.",
  "Best score": "Eng yaxshi ball", "Since first test": "Birinchi testdan beri", "Score history": "Ballar tarixi", "Accuracy by domain": "Bo‘limlar bo‘yicha aniqlik",
  "Weakest skills": "Eng zaif mavzular", "Drill accuracy": "Mashqlardagi aniqlik", "Pacing": "Tezlik", "Start a weak-skill drill": "Zaif mavzular mashqini boshlash",
  "Calibrate with an official score": "Rasmiy ball bilan solishtirish", "Save calibration": "Saqlash", "No calibration yet.": "Hali solishtirilmagan.",
  "Official Bluebook Math score": "Bluebook’dagi rasmiy Matematika balli", "App test to compare": "Solishtiriladigan test", "Open backup & sync": "Zaxira nusxani ochish",
  "Open any test to see every question, your answer and the solution.": "Har bir savol, javobingiz va yechimni ko‘rish uchun testni oching.",
  "Questions by difficulty": "Qiyinlik bo‘yicha savollar", "Counts every question you answered in the tests shown below, and how many you got right.": "Quyidagi testlarda javob bergan barcha savollaringiz va ulardan nechtasi to‘g‘ri ekani.",
  "History and saved tests are stored in this browser.": "Tarix va saqlangan testlar shu brauzerda saqlanadi.",
  "Your personal coach report, built from every test and drill you've taken.": "Ishlagan barcha test va mashqlaringiz asosidagi shaxsiy tahlil.",
  "Coach's feedback": "Murabbiy tahlili", "Quick insights": "Qisqa xulosalar", "Focus skills": "E’tibor berish kerak bo‘lgan mavzular", "Strong skills": "Kuchli mavzular", "Practice": "Mashq qilish",
  "Connect Claude in the app to get a written report. The numbers below update automatically.": "Yozma tahlil olish uchun Claude yoqilgan bo‘lishi kerak. Quyidagi raqamlar avtomatik yangilanadi.",
  "accuracy": "aniqlik", "questions": "savol", "per question": "bir savolga", "Medium": "O‘rta", "Hard": "Qiyin", "Extreme": "Juda qiyin", "Easy": "Oson",
  "Careless mistakes on medium questions": "O‘rta savollardagi e’tiborsizlik xatolari", "You have time to spare": "Vaqtingiz ortib qolyapti",
  "words": "so‘z", "to learn": "o‘rganish kerak", "learned": "o‘rganildi", "No words yet": "Hali so‘zlar yo‘q", "Go to Reading & Writing": "O‘qish va yozishga o‘tish",
  "Flashcards": "Kartochkalar", "To learn": "O‘rganish kerak", "Learned": "O‘rganildi", "Mark learned": "O‘rganildi deb belgilash",
  // ----- course
  "From the basics to SAT Math. Each lesson explains the topic, then gives a quiz. Score 100% to unlock the next lesson.": "Asoslardan SAT matematikasigacha. Har bir dars mavzuni tushuntiradi, so‘ng test beradi. Keyingi darsni ochish uchun 100% to‘plang.",
  "Your progress": "Natijangiz", "Next up:": "Keyingisi:", "Foundations": "Asoslar", "SAT topics": "SAT mavzulari", "Hard questions and full tests": "Qiyin savollar va to‘liq testlar",
  "Numbers, fractions, equations and graphs: the basics every SAT question needs.": "Sonlar, kasrlar, tenglamalar va grafiklar: har bir SAT savoli uchun kerak bo‘lgan asoslar.",
  "The four SAT Math domains, most common topics first.": "SAT matematikasining to‘rt bo‘limi, eng ko‘p uchraydigan mavzulardan boshlab.",
  "Harder practice and a full test every week.": "Qiyinroq mashqlar va har hafta bitta to‘liq test.",
  "Lesson + quiz": "Dars + test", "Task": "Topshiriq", "Done": "Bajarildi", "Passed": "O‘tildi", "← Course": "← Kurs", "Lesson quiz": "Dars testi", "Start the quiz": "Testni boshlash",
  // ----- sign-in
  "Sign in": "Kirish", "Create account": "Hisob ochish", "Continue with Google": "Google orqali davom etish", "or": "yoki", "Your name": "Ismingiz", "Email": "Email", "Password": "Parol",
  "Show": "Ko‘rsatish", "Hide": "Yashirish", "Created by": "Muallif:", "Not now, keep practicing without an account": "Hozir emas, hisobsiz davom etaman",
  "Any email works: iCloud, Gmail, Mail.ru, Yandex, Outlook. No Google or Apple sign-in needed.": "Istalgan email bo‘ladi: iCloud, Gmail, Mail.ru, Yandex, Outlook. Google yoki Apple orqali kirish shart emas.",
  "Create a free account. It takes ten seconds, and the practice you've already done on this device is saved to it.": "Bepul hisob oching. Bu o‘n soniya oladi, shu qurilmada ishlagan mashqlaringiz ham unga saqlanadi.",
  "Sign in to keep your scores and progress synced on every device.": "Ballaringiz va natijalaringiz barcha qurilmalarda saqlanishi uchun kiring.",
  "Creating account": "Hisob ochilmoqda", "Signing in": "Kirilmoqda",
  "Account created. Opening SAT Studio…": "Hisob ochildi. SAT Studio ochilmoqda…", "Signed in. Opening SAT Studio…": "Kirdingiz. SAT Studio ochilmoqda…",
  "Enter a valid email address, like name@gmail.com.": "To‘g‘ri email kiriting, masalan: ism@gmail.com.",
  "No account with that email and password. New here? Tap \"Create account\" above. It's free.": "Bunday email va parolli hisob topilmadi. Yangimisiz? Yuqoridagi “Hisob ochish”ni bosing. Bu bepul.",
  "You already have an account with this email. Enter your password to sign in.": "Bu email bilan hisobingiz bor. Kirish uchun parolni kiriting.",
  "Can't reach the server. Check your connection, or use offline mode.": "Serverga ulanib bo‘lmadi. Internetni tekshiring.",
  "Too many attempts. Wait a minute and try again.": "Juda ko‘p urinish. Bir daqiqa kutib, qayta urinib ko‘ring.",
  // ----- pricing and paywalls
  "SAT Studio Pro": "SAT Studio Pro", "Every test, every drill, a tutor on every question.": "Barcha testlar, barcha mashqlar va har bir savol uchun repetitor.",
  "Free during launch": "Hozircha bepul", "Right now everything in SAT Studio is open to everyone at no cost. These are the prices for when Pro opens; the free plan below stays free after that.": "Hozir SAT Studio’dagi hamma narsa hamma uchun bepul. Bular Pro ochilgandagi narxlar; quyidagi bepul tarif undan keyin ham bepul qoladi.",
  "1 month": "1 oy", "90-Day Pass": "90 kunlik tarif", "6 months": "6 oy", "Most popular": "Eng ommabop", "Opens soon": "Tez orada",
  "Get 1 month": "1 oyni olish", "Get 90-Day Pass": "90 kunlik tarifni olish", "Get 6 months": "6 oyni olish",
  "Try Pro before a test date.": "Imtihon oldidan Pro’ni sinab ko‘ring.", "Covers the whole 90-Day Course.": "90 kunlik kursning hammasini qamrab oladi.", "For two test dates and a retake.": "Ikki imtihon sanasi va qayta topshirish uchun.",
  "Free and Pro, side by side": "Bepul va Pro: taqqoslash", "Free": "Bepul", "Full adaptive tests": "To‘liq moslashuvchan testlar", "Unlimited": "Cheksiz",
  "AI-written tests and weak-skill drills": "AI yozgan testlar va zaif mavzular mashqi", "Not included": "Kirmaydi", "Included": "Kiradi",
  "Claude tutor, explanations and score reports": "Claude repetitori, tushuntirishlar va natija tahlili", "All 12 weeks": "Barcha 12 hafta",
  "Quick Practice, calculator, word bank, progress": "Tezkor mashq, kalkulyator, lug‘at, natijalar", "Questions": "Savollar",
  "How do I pay?": "Qanday to‘layman?", "Will I be charged again?": "Yana pul yechiladimi?", "What if I buy again while Pro is still active?": "Pro tugamasdan yana sotib olsam-chi?",
  "Can I get my money back?": "Pulimni qaytarib olsam bo‘ladimi?", "Is the free plan really free?": "Bepul tarif rostdan ham bepulmi?",
  "No. You pay once for a fixed number of days. When they run out you go back to the free plan and keep all your scores and history.": "Yo‘q. Ma’lum kunlar uchun bir marta to‘laysiz. Muddat tugagach bepul tarifga qaytasiz, barcha ballaringiz va tarixingiz saqlanib qoladi.",
  "The new days are added after the ones you already have, so you never lose time.": "Yangi kunlar mavjud kunlaringiz ustiga qo‘shiladi, vaqt yo‘qotmaysiz.",
  "Choose a plan, send the amount from Payme, Click, Uzum or any bank app to the card shown, then press \"I've paid\". We check the transfer and switch Pro on, usually the same day.": "Tarifni tanlang, summani Payme, Click, Uzum yoki istalgan bank ilovasi orqali ko‘rsatilgan kartaga yuboring va “To‘ladim” tugmasini bosing. Biz o‘tkazmani tekshirib, odatda shu kuniyoq Pro’ni yoqamiz.",
  "Pro isn't open yet": "Pro hali ochilmagan", "Keep practicing": "Mashqni davom ettirish",
  "You don't need it today: every test, drill and lesson is free during launch. When Pro opens, this is the price you'll see here.": "Bugun u sizga kerak emas: hozircha barcha testlar, mashqlar va darslar bepul. Pro ochilganda shu yerda aynan shu narxni ko‘rasiz.",
  "This test is part of Pro": "Bu test Pro tarifiga kiradi", "AI-written tests are part of Pro": "AI yozgan testlar Pro tarifiga kiradi", "The rest of the course is part of Pro": "Kursning qolgan qismi Pro tarifiga kiradi",
  "You've used today's free Claude answers": "Bugungi bepul Claude javoblari tugadi", "See Pro plans": "Pro tariflarni ko‘rish", "Not now": "Hozir emas", "That is": "Bu degani",
  "Create your free account first": "Avval bepul hisob oching", "Pro is attached to your account, so it follows you to every device. It takes ten seconds.": "Pro hisobingizga bog‘lanadi va barcha qurilmalarda ishlaydi. Bu o‘n soniya oladi.",
  "Sign in or create account": "Kirish yoki hisob ochish", "I've paid": "To‘ladim", "Copy": "Nusxalash", "Copied": "Nusxalandi", "Open Telegram": "Telegram’ni ochish",
  "Send us the receipt": "Chekni bizga yuboring", "Tell us you've paid": "To‘laganingizni bildiring", "Payments open soon": "To‘lovlar tez orada ochiladi",
  "We're checking your payment": "To‘lovingiz tekshirilmoqda", "You're on Pro": "Sizda Pro tarif", "Message us": "Bizga yozing",
  "Rushed misses": "Shoshilib qilingan xatolar", "Over 2× the target": "Maqsaddan 2 baravar ko‘p", "easy-question slips": "oson savollardagi xatolar",
  "Each bar is one question, in order. Bars that reach the top took three times the target or more. Select a bar to open that question below.": "Har bir ustun bitta savol, tartib bilan. Tepagacha yetgan ustunlar maqsaddan uch baravar yoki undan ko‘p vaqt olgan. Savolni pastda ochish uchun ustunni bosing.",
  "The line in the middle of each bar marks the target pace. Red means the skill takes much longer than the test allows.": "Har bir ustun o‘rtasidagi chiziq maqsad tezlikni ko‘rsatadi. Qizil rang mavzu testda berilgan vaqtdan ancha ko‘p vaqt olayotganini bildiradi.",
  "Move your progress between the claude.ai app, the downloaded copy, or another browser.": "Natijalaringizni boshqa brauzer yoki qurilmaga ko‘chiring.",
  "On this device:": "Shu qurilmada:", "results,": "ta natija,", "unfinished tests,": "ta tugallanmagan test,", "saved words.": "ta saqlangan so‘z.",
  "Tests that follow": "Quyidagi kitob bo‘yicha testlar:", "Topic Tests": "Mavzu testlari", "Hard Practice Tests": "Qiyin amaliy testlar",
  "5 questions with new numbers every time. You need": "Har safar yangi sonlar bilan 5 ta savol. Keyingi darsni ochish uchun", "5 out of 5": "5 tadan 5 ta",
  "to unlock the next lesson. If you miss one, read the explanation, review the lesson and take a new quiz.": "to‘g‘ri javob kerak. Xato qilsangiz, tushuntirishni o‘qing, darsni takrorlang va yangi test ishlang.",
  "Level not measured yet": "Daraja hali aniqlanmagan", "Tap to replay your level-up": "Daraja animatsiyasini qayta ko‘rish uchun bosing",
  "you@icloud.com or you@gmail.com": "siz@icloud.com yoki siz@gmail.com",
  // ----- misc
  "Download backup": "Zaxira nusxani yuklab olish", "Import backup": "Zaxira nusxani yuklash", "Close": "Yopish",
};

/* Phrases with numbers or names in them. First match wins. */
const P = [
  [/^(\d+) questions?, (\d+) min$/, "$1 ta savol, $2 daqiqa"],
  [/^Start (R&W )?Practice Test (\d+)$/, (m, rw, n) => `${rw ? "R&W " : ""}Amaliy test ${n} ni boshlash`],
  [/^(R&W )?Practice Test (\d+)$/, (m, rw, n) => `${rw ? "R&W amaliy" : "Amaliy"} test ${n}`],
  [/^Full SAT (\d+)$/, "To‘liq SAT $1"],
  [/^Best (\d+%?), (\d+) attempts?$/, "Eng yaxshi natija: $1, $2 ta urinish"],
  [/^(\d+) mistakes? waiting$/, "$1 ta xato kutmoqda"],
  [/^In progress: (.+), (\d+)\/(\d+) answered$/, "Davom etmoqda: $1, $2/$3 javob berilgan"],
  [/^Skill drills: (.+)$/, "Mavzu bo‘yicha mashqlar: $1"],
  [/^Book tests: (.+)$/, "Kitob testlari: $1"],
  [/^2 modules of (\d+)$/, "$1 tadan 2 ta modul"], [/^1 set of (\d+)$/, "$1 ta savol"], [/^(\d+) min$/, "$1 daqiqa"],
  [/^Your SAT estimate: (\d+)$/, "Taxminiy SAT ballingiz: $1"],
  [/^Math (\d+) \+ Reading and Writing (\d+), on the 400 to 1600 scale\.(?: Likely range (\d+)–(\d+)\.)? Your best so far: Math (\d+), R&W (\d+)\.$/,
    (m, a, b, lo, hi, c, d) => `Matematika ${a} + O‘qish va yozish ${b}, 400–1600 shkalada.${lo ? ` Ehtimoliy oraliq: ${lo}–${hi}.` : ""} Eng yaxshi natijalaringiz: Matematika ${c}, R&W ${d}.`],
  [/^Take a full test in (Reading and Writing|Math) to see your total score out of 1600\.$/, (m, s) => `1600 ballik umumiy natijani ko‘rish uchun ${s === "Math" ? "Matematikadan" : "O‘qish va yozishdan"} to‘liq test ishlang.`],
  [/^Level (\d) of (\d)$/, "$2 darajadan $1-chisi"], [/^points to (\w+)$/, "ball qoldi: $1 darajasigacha"],
  [/^Math (\d+), Reading & Writing (\d+)\. Each one leaves the list when you answer it correctly\.$/, "Matematika: $1, O‘qish va yozish: $2. To‘g‘ri javob bergan savolingiz ro‘yxatdan chiqadi."],
  [/^(\d+) of (\d+) drills left today · (\d+) Claude answers a day · 2 full tests per section$/, "Bugun $2 ta mashqdan $1 tasi qoldi · kuniga $3 ta Claude javobi · har bo‘limda 2 ta to‘liq test"],
  [/^(.+), Module 2 (harder|lower), (\d+)\/(\d+) correct$/, (m, d, h, a, b) => `${d}, 2-modul ${h === "harder" ? "qiyinroq" : "osonroq"}, ${a}/${b} to‘g‘ri`],
  [/^(.+), (\d+)\/(\d+) correct$/, "$1, $2/$3 to‘g‘ri"], [/^(\d+)% correct$/, "$1% to‘g‘ri"],
  [/^90-Day Course · Month (\d), Day ([\d–]+)$/, "90 kunlik kurs · $1-oy, $2-kun"],
  [/^Next: (.+) · (\d+) of (\d+) steps done$/, "Keyingisi: $1 · $3 qadamdan $2 tasi bajarildi"],
  [/^(Start|Continue): Day ([\d–]+)$/, (m, a, d) => `${a === "Start" ? "Boshlash" : "Davom etish"}: ${d}-kun`],
  [/^(\d+) of (\d+) steps$/, "$2 qadamdan $1 tasi"], [/^(\d+)\/(\d+) done$/, "$1/$2 bajarildi"],
  [/^Month (\d)$/, "$1-oy"], [/^Week (\d) · (.+)$/, "$1-hafta · $2"], [/^Week (\d)$/, "$1-hafta"], [/^Review quiz · (\d+) Q$/, "Takrorlash testi · $1 ta savol"],
  [/^Month (\d) · Day ([\d–]+) · (.+)$/, "$1-oy · $2-kun · $3"], [/^Best (\d+)%$/, "Eng yaxshi: $1%"],
  [/^Not quite\. The answer is ([A-D])\.$/, "Unchalik emas. To‘g‘ri javob: $1."], [/^Retry (\d+) missed$/, "$1 ta xatoni qayta ishlash"],
  [/^(\d+) of (\d+) correct so far$/, "Hozircha $2 tadan $1 tasi to‘g‘ri"],
  [/^Likely range (\d+)–(\d+)$/, "Ehtimoliy oraliq: $1–$2"], [/^Predicted now, likely (\d+)–(\d+)$/, "Hozirgi taxmin: $1–$2"],
  [/^Accuracy, (\d+) questions$/, "Aniqlik, $1 ta savol"], [/^Per question \(target ([\d:]+)\)$/, "Bir savolga (maqsad: $1)"], [/^\(target ([\d:]+)\)$/, "(maqsad: $1)"],
  [/^Target pace, ([\d:]+) per question$/, "Maqsad: bir savolga $1"], [/^Module (\d), Q(\d+)$/, "$1-modul, $2-savol"],
  [/^(\d+) out of (\d+)$/, "$2 tadan $1 tasi"],
  [/^You missed (\d+) questions across (\d+) skills?$/, "$2 ta mavzudan $1 ta savolda xato qildingiz"],
  [/^(\d+) easy questions? missed in Module 1\.$/, "1-modulda $1 ta oson savolda xato."],
  [/^Weighted score (\d+)% · routing line about (\d+)%\.$/, "Vaznli natija: $1% · chegara taxminan $2%."],
  [/^Save (\d+)%$/, "$1% tejaysiz"], [/^(\d+) days of Pro$/, "$1 kun Pro"], [/^([\d ]+) so'm a month$/, "oyiga $1 so‘m"],
  [/^([\d ]+) so'm a month · (\d+) days of Pro$/, "oyiga $1 so‘m · $2 kun Pro"], [/^([\d ]+) so'm$/, "$1 so‘m"], [/^so'm$/, "so‘m"],
  [/^(\d+) a day$/, "kuniga $1 ta"], [/^(\d+) answers a day$/, "kuniga $1 ta javob"], [/^Week (\d)$/, "$1-hafta"],
  [/^Practice Tests 1 and 2 per section, plus Full SAT 1$/, "Har bo‘limda 1- va 2-amaliy test hamda To‘liq SAT 1"],
  [/^All (\d+) section tests and (\d+) Full SATs, plus Challenge Test and Fresh mix$/, "Barcha $1 ta bo‘lim testi va $2 ta To‘liq SAT, Qiyin test va Yangi savollar"],
  [/^Founding price for our first 100 students\. One payment, no auto-renewal, nothing to cancel\.(?: Not for you\? Tell us within (\d+) days and we send the money back\.)?$/,
    (m, g) => `Birinchi 100 o‘quvchi uchun maxsus narx. Bir martalik to‘lov, avtomatik uzaytirish yo‘q.${g ? ` Yoqmadimi? ${g} kun ichida ayting, pulni qaytaramiz.` : ""}`],
  [/^Sitting the SAT costs about \$111 each time\. Pro is the practice that makes one sitting enough: (\d+) full adaptive section tests, unlimited drills, and Claude explaining every question you miss\.$/,
    "SAT topshirish har safar taxminan 111 dollar turadi. Pro bir martada topshirishga yordam beradi: $1 ta to‘liq moslashuvchan test, cheksiz mashqlar va har bir xatoingizni tushuntiradigan Claude."],
  [/^Yes\. If Pro isn't what you expected, message us within (\d+) days of paying and we return the full amount to your card\.$/, "Ha. Pro kutganingizdek bo‘lmasa, to‘lovdan keyin $1 kun ichida yozing, butun summani kartangizga qaytaramiz."],
  [/^Yes, with no time limit\. You can sit two full tests in each section, a Full SAT, (\d+) drills a day and all of Quick Practice without paying\.$/, "Ha, muddatsiz. Har bo‘limda ikkita to‘liq test, bitta To‘liq SAT, kuniga $1 ta mashq va butun Tezkor mashqni bepul ishlashingiz mumkin."],
  [/^Free accounts get Practice Tests 1 and 2 in Math and in Reading & Writing, plus Full SAT 1, with unlimited retakes\. Pro opens all (\d+) section tests, (\d+) Full SATs, the Challenge Test and Fresh mix\.$/,
    "Bepul tarifda Matematika va O‘qish-yozishdan 1- va 2-amaliy testlar hamda To‘liq SAT 1 bor, ularni cheksiz qayta ishlash mumkin. Pro barcha $1 ta bo‘lim testi, $2 ta To‘liq SAT, Qiyin test va Yangi savollarni ochadi."],
  [/^(\d+) missed\. About (\d+) of them come from habits or skills you can fix, starting with$/, "$1 ta xato. Ulardan taxminan $2 tasi tuzatsa bo‘ladigan odat yoki mavzulardan, avvalo:"],
  [/^Pro turns that list into practice: unlimited drills on each skill, AI-written questions on your weakest ones, and (\d+) Claude explanations a day\.$/, "Pro bu ro‘yxatni mashqqa aylantiradi: har bir mavzu bo‘yicha cheksiz mashqlar, eng zaif mavzularingizdan AI yozgan savollar va kuniga $1 ta Claude tushuntirishi."],
  [/^You average ([\d:]+) per question; the real test allows about ([\d:]+)\. Slowest skills first:$/, "Bir savolga o‘rtacha $1 sarflayapsiz; haqiqiy testda taxminan $2 beriladi. Eng sekin mavzulardan boshlab:"],
  [/^([\d:]+) avg, (\d+)% correct$/, "o‘rtacha $1, $2% to‘g‘ri"], [/^Level (\d) of (\d): (\w+)$/, "$2 darajadan $1-chisi: $3"],
  [/^Pay ([\d ]+) so'm$/, "$1 so‘m to‘lash"], [/^Send ([\d ]+) so'm$/, "$1 so‘m yuboring"], [/^Created by (.+)$/, "Muallif: $1"],
];

// ----- Module 1 gate (free students: Module 2 and the score are Pro)
Object.assign(D, {
  "Everything unlocked": "Hammasi ochiq", "Free, no time limit": "Bepul, muddatsiz", "Module 1 done": "1-modul tugadi", "Module 2": "2-modul", "Your score": "Ballingiz", "Your score report": "Natijalar tahlili",
  "You earned the harder Module 2. That is the route where scores above about 600 are possible.": "Sizga qiyinroq 2-modul tushdi. Taxminan 600 dan yuqori ball faqat shu yo‘nalishda mumkin.",
  "Your Module 2 is ready at the easier level. Finish it to see your score and which skills cost you points.": "2-modulingiz yengilroq darajada tayyor. Ballingizni va qaysi mavzularda ball yo‘qotganingizni bilish uchun uni tugating.",
  "An estimate on the 200 to 800 scale": "200–800 shkalasidagi taxminiy ball", "Every skill, and every mistake explained": "Har bir mavzu va har bir xato tushuntirilgan",
  "Unlock Module 2": "2-modulni ochish", "Continue to Module 2": "2-modulga o‘tish", "Send to a parent": "Ota-onaga yuborish", "Send this to a parent": "Buni ota-onaga yuborish",
  "Does a parent pay?": "To‘lovni ota-onangiz qiladimi?",
  "Your Module 1 answers are saved. Come back any time and Module 2 will be waiting.": "1-modul javoblaringiz saqlandi. Istalgan payt qaytsangiz, 2-modul sizni kutadi.",
  "Module 1 of Practice Tests 1 and 2 per section, plus Full SAT 1": "Har bo‘limda 1- va 2-amaliy testning 1-moduli hamda To‘liq SAT 1",
});
P.push(
  [/^(\d+) of (\d+) correct in Module 1$/, "1-modulda $2 tadan $1 tasi to‘g‘ri"],
  [/^(\d+) questions, built from your Module 1$/, "$1 ta savol, 1-modul natijangizga qarab tuzilgan"],
  [/^([\d ]+) so'm · ([\d ]+) so'm a month$/, "$1 so‘m · oyiga $2 so‘m"],
  [/^One payment, no auto-renewal\. Pay by Payme, Click or Uzum card transfer\.(?: (\d+)-day money-back promise\.)?$/, (m, g) => `Bir martalik to‘lov, avtomatik uzaytirish yo‘q. Payme, Click yoki Uzum orqali karta o‘tkazmasi bilan to‘lang.${g ? ` ${g} kun ichida pulni qaytarish kafolati.` : ""}`],
  [/^You have a saved attempt: Module 1 done, (\d+) of (\d+) answered, Module 2 is waiting\.$/, "Saqlangan urinishingiz bor: 1-modul tugagan, $1 / $2 ta javob berilgan, 2-modul kutmoqda."],
  [/^Free accounts can take Module 1 of Practice Tests 1 and 2 in Math and in Reading & Writing, and of Full SAT 1\. Pro opens Module 2 and your score, plus all (\d+) section tests, (\d+) Full SATs, the Challenge Test and Fresh mix\.$/, "Bepul tarifda Matematika va O‘qish-yozishdan 1- va 2-amaliy testlarning hamda To‘liq SAT 1 ning 1-modulini ishlash mumkin. Pro 2-modulni va ballingizni, shuningdek barcha $1 ta bo‘lim testi, $2 ta To‘liq SAT, Qiyin test va Yangi savollarni ochadi."],
  [/^Module 2 and your score on every test: all (\d+) section tests and (\d+) Full SATs, plus Challenge Test and Fresh mix$/, "Har bir testda 2-modul va ballingiz: barcha $1 ta bo‘lim testi va $2 ta To‘liq SAT, Qiyin test va Yangi savollar"],
  [/^Yes, with no time limit\. You can take Module 1 of the free tests as often as you like, plus (\d+) drills a day and all of Quick Practice, without paying\. Module 2 and your score are Pro\.$/, "Ha, muddat cheklovisiz. Bepul testlarning 1-modulini istagancha ishlashingiz, kuniga $1 ta mashq va Tezkor mashqning hammasini to‘lovsiz bajarishingiz mumkin. 2-modul va ball Pro tarifda."],
);

const SKIP = ".tbar,.tmain,.tfoot,.passage,.qtext,.stem,.choices,.choice,.expl,.item,.motive,.crbody,.crq,.qpq,.qpc,.calc,.refsheet,#dirsheet,script,style,svg,code,input,textarea,[data-notr]";
const SKIPA = SKIP.replace(",input,textarea", "");     // placeholders live on inputs, so attributes use a narrower skip list
function tr(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t || t.length > 420 || !/[A-Za-z]{2}/.test(t)) return null;
  let u = Object.prototype.hasOwnProperty.call(D, t) ? D[t] : null;
  if (u == null) for (const [re, rep] of P) { if (re.test(t)) { u = t.replace(re, rep); break; } }
  if (u == null || u === t) return null;
  return s.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + u + b);
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { const el = root.parentElement; if (el && !el.closest(SKIP)) { const u = tr(root.nodeValue); if (u != null) root.nodeValue = u; } return; }
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const todo = [];
  while ((n = w.nextNode())) { const el = n.parentElement; if (el && !el.closest(SKIP)) { const u = tr(n.nodeValue); if (u != null) todo.push([n, u]); } }
  todo.forEach(([node, u]) => { node.nodeValue = u; });
  const els = root.querySelectorAll ? [root, ...root.querySelectorAll("[placeholder],[aria-label],[title]")] : [];
  els.forEach(e => { if (e.closest && e.closest(SKIPA)) return; for (const a of ["placeholder", "aria-label", "title"]) { const v = e.getAttribute && e.getAttribute(a); if (v) { const u = tr(v); if (u != null) e.setAttribute(a, u); } } });
}
const ATTR = { "Ali Karimov": "Ali Karimov", "At least 8 characters": "Kamida 8 ta belgi", "Your password": "Parolingiz", "Show password": "Parolni ko‘rsatish", "Main": "Asosiy menyu", "Filter tests": "Testlarni saralash", "Subject": "Fan", "Close": "Yopish" };
Object.assign(D, {
  "Drills are part of Pro": "Mashqlar Pro’ga kiradi",
  "Redo my mistakes is always open. Pro opens unlimited drills on every skill.": "Xatolarimni qayta ishlash doim ochiq. Pro har bir mavzu bo‘yicha cheksiz mashqlarni ochadi.",
  "The 90-Day Course is part of Pro": "90 kunlik kurs Pro’ga kiradi",
  "Pro opens all 12 weeks, from the basics to full timed tests.": "Pro barcha 12 haftani ochadi: asoslardan to‘liq vaqtli testlargacha.",
  "The Claude tutor is part of Pro": "Claude repetitori Pro’ga kiradi",
  "Module 1 of the free tests": "Bepul testlarning 1-moduli",
});
Object.assign(D, ATTR);
function start() {
  walk(document.body);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === "characterData") walk(m.target);
      else if (m.type === "childList") m.addedNodes.forEach(walk);
      if (m.type === "attributes") { const e = m.target; if (e.closest && !e.closest(SKIPA)) { const v = e.getAttribute(m.attributeName), u = v && tr(v); if (u != null) e.setAttribute(m.attributeName, u); } }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
}
if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
