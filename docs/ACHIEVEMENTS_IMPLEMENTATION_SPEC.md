# 30-0 Achievement Implementation Spec

Finalized scope: **95 achievements**.

## Non-negotiable behavior

- Evaluate every achievement; more than one may trigger.
- Show only achievements earned in the current run.
- No catalog, locked list, counters, history, persistence, or Supabase changes.
- Result page: localized title and description; hide the section when empty.
- Cup: reveal achievements only after the full match path finishes revealing.
- Clipboard: localized `Досягнення:` / `Achievements:` header plus localized titles only.

## World Cup 2006 correction

- Bohdan Shust (`38297`) belongs to the official final 23 and must count after import.
- Oleksandr Aliev (`9796`) was not in the final 23 and must not count.

## Final text and threshold corrections

- Achievement 11 UA title: `За Вами виїхала СБУ`.
- Achievement 47: at least two players from each of the 1990s, 2000s, 2010s and 2020s.
- Achievement 54: `75+` League goals.
- Achievement 55: `55+` League goals and `40+` League goals conceded.
- Achievement 10/11 descriptions use the approved anti-Ukrainian views/actions wording.
- Achievement 59 UA description uses the approved Nikola Vasilj wording.
- Achievement 40 EN description uses `Reunite`.

## Registry

The runtime registry contains exactly 95 achievements. Rarity is production metadata only and does not affect evaluation, simulation, scoring, leaderboard submission, or sharing.

Final rarity distribution: common 12, rare 8, epic 22, legendary 53.

| ID | UA | EN | Mode | Rarity | Condition |
|---:|---|---|---|---|---|
| 1 | Кєнти | Kents | Both | legendary | Milevskyi + Aliyev, any clubs/eras |
| 2 | Файне місто | Faine Misto | Both | epic | Nyva Ternopil players >= 2 |
| 3 | Третя сила | The Third Force | Both | epic | Win League/Cup; Dynamo count = 0; Shakhtar count = 0 |
| 4 | Мрія Луческу | Lucescu’s Dream | Both | legendary | Players whose citizenships include Brazil >= 9 |
| 5 | Іноземний легіон | Foreign Legion | Both | legendary | All 11 have known citizenship; none includes Ukraine |
| 6 | Слава Україні! | Slava Ukraini! | Both | common | All 11 citizenship arrays include Ukraine |
| 7 | Донбас порожняк не гонить | Donbas Delivers | Both | legendary | Approved Donbas team IDs count >= 8 |
| 8 | Крим — це Україна! | Crimea Is Ukraine! | Both | rare | Approved Crimea team IDs count >= 3 |
| 9 | Кубок Львову! | Cup to Lviv! | Cup | legendary | Won Cup; Karpaty Lviv count >= 1 |
| 10 | Зрада | Zrada | Both | common | Any unique player matches: citizenships include Russia/Belarus OR player_id in FLAGGED_ZRADA_PLAYER_IDS |
| 11 | За Вами виїхала СБУ | SBU Is Coming for You | Both | common | At least 2 unique players match: citizenships include Russia/Belarus OR player_id in FLAGGED_ZRADA_PLAYER_IDS |
| 12 | Перед каждою ігрою!.. | Before Every Game!.. | League | common | losses > wins + draws |
| 13 | Здається, Бог наказує нас за щось | Apparently, God Punishes Us | Both | common | Cup first match loss OR League verdict = relegation |
| 14 | Перші назавжди | First Forever | League | legendary | League champion; Tavriya count >= 2 |
| 15 | Весна 1999 | Spring 1999 | Both | legendary | Win; (Dynamo 1990s >= 2 OR Dynamo any >= 4) |
| 16 | Стамбул 2009 | Istanbul 2009 | Cup | legendary | Won Cup; (Shakhtar 2000s >= 2 OR Shakhtar any >= 4) |
| 17 | Варшава 2015 | Warsaw 2015 | Cup | legendary | Reached final; (Dnipro 2010s >= 2 OR Dnipro any >= 4) |
| 18 | Ударна пара | Strike Partnership | Both | legendary | Shevchenko + Rebrov |
| 19 | Золотий м’яч | Ballon d’Or | Both | legendary | Win; Andriy Shevchenko in squad |
| 20 | СаШо | SaSho | Cup | legendary | Shovkovskyi in squad; any penalty shootout win |
| 21 | Німеччина 2006 | Germany 2006 | Both | legendary | Approved 2006 squad player ID set count >= 5 |
| 22 | Перший Кубок | The First Cup | Cup | legendary | Won Cup; Chornomorets count >= 3 |
| 23 | Непереможні | Invincibles | League | legendary | losses = 0 |
| 24 | Безкомпромісні | No Compromises | League | legendary | draws = 0 |
| 25 | Ідеально збалансовано | Perfectly Balanced | League | epic | wins = 10; draws = 10; losses = 10 |
| 26 | Потужно | Powerful Stuff | League | legendary | wins = 30 |
| 27 | Сухий закон | Prohibition | Both | legendary | League GA <= 15 OR (Won Cup AND Cup GA = 0) |
| 28 | На класі | Pure Class | Cup | legendary | Won Cup; regularTimeWins = matches.length |
| 29 | Нерви зі сталі | Nerves of Steel | Cup | legendary | Won Cup; ET/penalty matches >= 3 |
| 30 | Завдання провалено успішно | Task Failed Successfully | Cup | legendary | Won Cup; regularTimeWins = 0 |
| 31 | Я так бачу | Trust My Eyes | Both | epic | mode = hardcore; win League/Cup |
| 32 | Монобільшість | Single-Party Majority | Both | legendary | max count by team_id >= 6 |
| 33 | Коаліція | Coalition | Both | common | unique team_ids = 11 |
| 34 | Три мушкетери | The Three Musketeers | Both | legendary | formation 3-5-2; three CB slot team_ids identical |
| 35 | Автобус припарковано | Bus Parked | Both | legendary | formation 5-3-2; win; League GA <=20 OR Cup GA <=2 |
| 36 | Гдє «Дінамо», гдє? | Where TF “Dynamo” at? | Both | legendary | Win; (Jádson OR (Shakhtar >=3 AND Dynamo=0)) |
| 37 | На благо города і всєх харьковчан | For the Good of Kharkiv and All of the Citizens | Both | legendary | Win; (Metalist 2010s >=2 OR Metalist any >=4) |
| 38 | Ящик горілки | A Crate of Vodka | Both | epic | Volyn >=3; at least one League/Cup win |
| 39 | Полтавська битва | Battle of Poltava | Cup | legendary | Won Cup; Vorskla >=2 |
| 40 | Дніпровський тандем | Dnipro Tandem | Both | legendary | Rotan + Nazarenko |
| 41 | Серце «Шахтаря» | Heart of Shakhtar | Both | legendary | Win; Darijo Srna in squad |
| 42 | Бразильський трикутник | Brazilian Triangle | Both | legendary | Jádson + Fernandinho + Shakhtar Willian |
| 43 | Слава нації | Good Evening, We Are from Ukraine | Both | legendary | hardcore; win; all 11 include Ukraine |
| 44 | ООН | United Nations | Both | legendary | unique primary normalized citizenships >=8 |
| 45 | Балканський експрес | Balkan Express | Both | legendary | approved Balkan citizenship set count >=5 |
| 46 | Латиноамериканський квартал | Latin Quarter | Both | legendary | South American citizenship set count >=6 |
| 47 | Різні епохи. Один склад. | Different Eras. One Squad. | Both | common | At least two unique players from each decade: 1990s, 2000s, 2010s and 2020s |
| 48 | Жити по-новому | Living a New Way | Both | common | 2020s count >=6 |
| 49 | Назад у 90-ті | Back to the ’90s | Both | epic | 1990s count >=6 |
| 50 | Пропало все. Господи допоможи | Everything Is Lost. God Save Us All | League | legendary | wins = 0 |
| 51 | Нічия влаштовує | A Draw Will Do | League | epic | draws >=15 |
| 52 | Маємо те, що маємо | It Is What It Is | League | rare | verdict = midTable; goalDifference = 0 |
| 53 | На тоненького | By a Thread | League | legendary | verdict = championship; goalDifference <=10 |
| 54 | Бавовна | Bavovna | League | epic | League goalsFor >=75 |
| 55 | Захист для слабаків | Defense Optional | League | epic | League goalsFor >=55 and goalsAgainst >=40 |
| 56 | Лото «Забава» | The Lottery | Cup | legendary | Won Cup; final decidedBy = penalties |
| 57 | На 120-й | In the 120th | Cup | legendary | Won Cup; final decidedBy = extra_time |
| 58 | Пливли-пливли, а на березі... | Ch-ch-ch-choke Me! | Cup | epic | Last played stage = final; wonCup = false |
| 59 | I Am from Bosnia, Take Me to America | I Am from Bosnia, Take Me to America | Both | epic | player_id = 248454 is present in the final squad |
| 60 | На мінімалках | Bare Minimum | Cup | legendary | Won Cup; every non-penalty win margin <=1 |
| 61 | Динамівські серця | Hearts of “Dynamo” | Both | legendary | Dynamo players whose citizenships include Ukraine >=4 |
| 62 | Фінал 2006 | Final 2006 | Cup | legendary | Reached final; (Metalurh Zap 2000s >=2 OR any >=4) |
| 63 | Легенда «Барселони» | Barcelona’s Legend | Both | epic | player_id = 13091 is present in the final squad |
| 64 | Промислова революція | Industrial Revolution | Both | rare | >=1 each: Metalurh Zap, Metalurh Donetsk, Mariupol line |
| 65 | Два крила | Two Wings | Both | legendary | Yarmolenko + Konoplyanka |
| 66 | Крізь роки | Through the Years | Both | legendary | same team_id has 1990s, 2000s, 2010s, 2020s entries |
| 67 | Кобзарі | The Kobzars | Both | legendary | approved Shevchenko player ID set count >=3 |
| 68 | Акт Злуки | Act of Unity | Both | common | Donbas >=2; Lviv club group >=2 |
| 69 | Кордони 1991 | Borders of 1991 | Both | epic | Win; Crimea >=1; Donbas >=1 |
| 70 | Львівське метро | Lviv Metro | Both | epic | Karpaty >=1; Rukh >=1; PFC Lviv >=1 |
| 71 | Котлета по-київськи | Chicken Kyiv | Both | epic | Kyiv club count >=5; unique approved Kyiv team_ids >=3 |
| 72 | Кубок світу | World Cup | Both | legendary | unique primary citizenships = 11 |
| 73 | Кубок Африки | Africa Cup | Both | legendary | African citizenship set count >=5 |
| 74 | День бабака | Groundhog Day | Cup | epic | >=3 wins with identical goalsFor-goalsAgainst; pre-shootout score for penalties |
| 75 | Стара школа | Old School | Both | legendary | hardcore; formation 4-4-2; win |
| 76 | Так! | Yes! | Both | rare | 2000s count >=6 |
| 77 | Покращення вже сьогодні | A Better Life Today | Both | common | 2010s count >=6 |
| 78 | Опорник із Запоріжжя | CDM from Zaporizhzhia | Both | rare | eligible player ID assigned to slot whose allowed_positions includes CDM |
| 79 | Мужики | The Lads | Both | epic | Zorya>=3 OR (Zorya>=2 AND champion/europe/Cup win) |
| 80 | Бойся Бога і пацанов с Крівова Рога | Fear God and Chaps from Kryvyi Rih | Both | epic | Kryvbas>=3 OR (Kryvbas>=2 AND champion/europe/Cup win) |
| 81 | Олександрійське диво | Oleksandriya Miracle | Both | legendary | champion/europe/Cup win AND (Oleksandriya 2010s>=2 OR any>=3) |
| 82 | Ковалівка в Європі | Kovalivka in Europe | Both | epic | Kolos count >= 2 AND (Cup reached semi-final/final/won OR League verdict IN {European qualification, championship}) |
| 83 | Потримай моє пиво | Hold My Beer | Both | epic | approved Obolon IDs >=3; at least one win |
| 84 | Українське класичне | Ukrainian Clásico | Both | epic | Dynamo>=2; Shakhtar>=2 |
| 85 | Ми всі різні, але ми українці | United Ukraine | Both | rare | all 11 include Ukraine; unique team_ids=11 |
| 86 | Міміно | Mimino | Both | legendary | citizenships include Georgia count >=3 |
| 87 | Суперорли | Super Eagles | Both | legendary | citizenships include Nigeria count >=3 |
| 88 | Лінія Мажино | Maginot Line | Both | legendary | formation 5-3-2; five defensive slot team_ids identical |
| 89 | П’ять пальців | Five Fingers | Both | common | formation 5-3-2; five defensive slot team_ids unique |
| 90 | П’ятий елемент | The Fifth Element | Both | epic | formation 3-5-2; five midfield slots have five unique primary citizenships |
| 91 | Тризуб | Tryzub | Both | common | formation 3-5-2; all CB include Ukraine; three unique team_ids |
| 92 | Дуплет | Double Tap | Both | rare | two attack slot team_ids identical; at least one win |
| 93 | Це нормально | This Is Fine | League | legendary | goalsAgainst >=60; verdict != relegation |
| 94 | Кийов і Львов не указ Ужгородови | Kyiv and Lviv Don’t Rule Uzhorod | Both | rare | Uzhhorod>=1; Kyiv=0; Lviv=0 |
| 95 | Албанська мафія | Ti Shqipëri, më jep nder | Both | legendary | citizenships include Albania count >=2 |
