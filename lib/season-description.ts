import type { DraftPlayer, Lineup } from "@/lib/draft-types";
import type { SeasonResult, SeasonVerdict } from "@/lib/seasonSimulation";

type TeamProfile = {
  verdict: SeasonVerdict;
  tier:
    | "perfect"
    | "dominantTitle"
    | "championship"
    | "titleChallenge"
    | "europe"
    | "strongMidTable"
    | "midTable"
    | "survival"
    | "relegation";
  bestPosition: string;
  overall: number;
  attack: number;
  defense: number;
  goalkeeper: number;
  midfield: number;
  balanced: boolean;
  weak: boolean;
  lowScoringSolid: boolean;
  chaotic: boolean;
  strongAttack: boolean;
  strongDefense: boolean;
  eliteGoalkeeper: boolean;
  dominantMidfield: boolean;
  overachieving: boolean;
  underachieving: boolean;
};

type Description = {
  en: string;
  ua: string;
  matches: (profile: TeamProfile) => boolean;
  priority?: number;
};

const rating = (player: DraftPlayer | undefined) =>
  player?.effective_global_rating ?? player?.global_rating ?? 65;

function average(players: Array<DraftPlayer | undefined>) {
  const present = players.filter((player): player is DraftPlayer => Boolean(player));
  return present.length === 0
    ? 65
    : present.reduce((total, player) => total + rating(player), 0) / present.length;
}

function teamProfile(lineup: Lineup, result: SeasonResult): TeamProfile {
  const players = Object.values(lineup);
  const bestPlayer = players.reduce<DraftPlayer | undefined>(
    (best, player) => !best || rating(player) > rating(best) ? player : best,
    undefined,
  );
  const attack = average([lineup.am_fw, lineup.fw]);
  const defense = average([lineup.lb, lineup.cb_1, lineup.cb_2, lineup.rb]);
  const goalkeeper = average([lineup.gk]);
  const midfield = average([lineup.lm, lineup.cm, lineup.am_cm, lineup.rm]);
  const units = [attack, defense, goalkeeper, midfield];
  const overall = average(players);
  const tier = result.wins === 30
    ? "perfect"
    : result.verdict === "championship" && (result.points >= 80 || result.wins >= 25)
      ? "dominantTitle"
      : result.verdict === "championship"
        ? "championship"
        : result.verdict === "europe" && result.points >= 57
          ? "titleChallenge"
          : result.verdict === "europe"
            ? "europe"
            : result.verdict === "midTable" && result.points >= 42
              ? "strongMidTable"
              : result.verdict === "midTable"
                ? "midTable"
                : result.points >= 24
                  ? "survival"
                  : "relegation";

  return {
    verdict: result.verdict,
    tier,
    bestPosition: bestPlayer?.game_position ?? "",
    overall,
    attack,
    defense,
    goalkeeper,
    midfield,
    balanced: Math.max(...units) - Math.min(...units) <= 6,
    weak: average(players) < 62,
    lowScoringSolid: result.goalsFor <= 34 && result.goalsAgainst <= 34,
    chaotic:
      (result.goalsFor >= 44 && result.goalsAgainst >= 40)
      || attack - defense >= 9,
    strongAttack: attack >= 75 || result.goalsFor >= 52,
    strongDefense: defense >= 74 || result.goalsAgainst <= 27,
    eliteGoalkeeper: goalkeeper >= 80,
    dominantMidfield: midfield >= 76 && midfield >= attack && midfield >= defense,
    overachieving:
      (result.verdict === "championship" && overall < 72)
      || (result.verdict === "europe" && overall < 67)
      || (result.verdict === "midTable" && overall < 61),
    underachieving:
      (result.verdict === "midTable" && overall >= 72)
      || (result.verdict === "relegation" && overall >= 65),
  };
}

const defaults: Description[] = [
  {
    en: "Thirty matches, thirty wins, no loose ends. Perfection stopped being a target and became the weekly routine.",
    ua: "Тридцять матчів, тридцять перемог, жодних недомовок. Досконалість перестала бути метою й стала щотижневою рутиною.",
    matches: (profile) => profile.tier === "perfect",
    priority: 10,
  },
  {
    en: "A flawless season, signed and sealed. The opposition kept changing; the result stubbornly refused to.",
    ua: "Бездоганний сезон із підписом і печаткою. Суперники змінювалися, результат уперто залишався тим самим.",
    matches: (profile) => profile.tier === "perfect",
    priority: 10,
  },
  {
    en: "Champions at full volume. The title race became a procession long before the final whistle of the season.",
    ua: "Чемпіони на повній гучності. Титульна гонка перетворилася на ходу переможців задовго до останнього свистка сезону.",
    matches: (profile) => profile.tier === "dominantTitle",
    priority: 8,
  },
  {
    en: "The trophy was earned with margin to spare. Even the difficult weeks looked suspiciously comfortable.",
    ua: "Трофей здобуто із солідним запасом. Навіть складні тижні виглядали підозріло комфортними.",
    matches: (profile) => profile.tier === "dominantTitle",
    priority: 8,
  },
  {
    en: "The title challenge had substance, not just noise. One sharper run might have turned a fine season into a parade.",
    ua: "У чемпіонських амбіціях було більше змісту, ніж шуму. Ще одна вдала серія могла перетворити сильний сезон на парад.",
    matches: (profile) => profile.tier === "titleChallenge",
    priority: 7,
  },
  {
    en: "Close enough to dream, not quite ruthless enough to reign. The leaders were made to look over their shoulders.",
    ua: "Достатньо близько, щоб мріяти, але не настільки безжально, щоб царювати. Лідерів принаймні змусили озиратися.",
    matches: (profile) => profile.tier === "titleChallenge",
    priority: 7,
  },
  {
    en: "The attack wrote the headlines and rarely needed an editor. Goals arrived in waves, along with a title nobody could seriously dispute.",
    ua: "Атака сама писала заголовки й майже не потребувала редактора. Голи приходили хвилями, а з ними й титул без серйозних заперечень.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.strongAttack,
    priority: 6,
  },
  {
    en: "The title was protected before it was celebrated. A disciplined back line turned narrow leads into a season-long habit.",
    ua: "Титул спочатку захистили, а вже потім відсвяткували. Дисциплінована оборона перетворила мінімальні переваги на сезонну звичку.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.strongDefense,
    priority: 6,
  },
  {
    en: "The goalkeeper made difficult saves look administrative. Behind that security, the rest of the team played like champions.",
    ua: "Воротар перетворив складні сейви на адміністративну процедуру. За такої надійності решта команди могла грати по-чемпіонськи.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.eliteGoalkeeper,
    priority: 6,
  },
  {
    en: "The midfield ran the season like a control room. Matches were managed, accelerated and closed with impressive authority.",
    ua: "Півзахист керував сезоном, наче диспетчерська. Матчі контролювали, прискорювали й закривали з переконливою владністю.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.dominantMidfield,
    priority: 6,
  },
  {
    en: "No obvious weakness, no need for excuses. Balance carried this team through the long weeks and onto the top step.",
    ua: "Без очевидних слабкостей і без потреби у виправданнях. Баланс провів команду крізь довгу дистанцію на найвищу сходинку.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.balanced,
    priority: 5,
  },
  {
    en: "Champions by results, overachievers by reputation. The table confirms that good organisation can still embarrass grander plans.",
    ua: "Чемпіони за результатом, надможливості за репутацією. Таблиця підтвердила: добра організація й досі вміє псувати чужі великі плани.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.overachieving,
    priority: 6,
  },
  {
    en: "European qualification secured with attacking intent. Subtlety was optional; creating danger was not.",
    ua: "Єврокубкову путівку здобуто з атакувальним наміром. Вишуканість була необов'язковою, небезпека біля воріт — постійною.",
    matches: (profile) => profile.verdict === "europe" && profile.strongAttack,
    priority: 5,
  },
  {
    en: "Europe was reached through locked doors and narrow margins. The defence made sure one goal often felt like enough.",
    ua: "До Європи дісталися через зачинені двері й мінімальні рахунки. Захист подбав, щоб одного гола часто було достатньо.",
    matches: (profile) => profile.verdict === "europe" && profile.strongDefense,
    priority: 5,
  },
  {
    en: "The goalkeeper collected points as efficiently as saves. European qualification owes plenty to the last line.",
    ua: "Воротар збирав очки не менш вправно, ніж сейви. Єврокубкова путівка багато чим завдячує останньому рубежу.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.eliteGoalkeeper,
    priority: 5,
  },
  {
    en: "The midfield supplied the map and the tempo. Europe is the reward for a season played with a clear idea.",
    ua: "Півзахист давав і карту, і темп. Єврокубки стали нагородою за сезон, проведений із чіткою ідеєю.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.dominantMidfield,
    priority: 5,
  },
  {
    en: "A European place from a squad that looked stronger together than on paper. The table has a soft spot for collective nerve.",
    ua: "Єврокубкове місце для команди, яка разом виглядала сильнішою, ніж на папері. Таблиця інколи винагороджує колективний характер.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.overachieving,
    priority: 5,
  },
  {
    en: "A lively season with the handbrake apparently removed. The goals entertained; the defending occasionally joined the audience.",
    ua: "Жвавий сезон із демонстративно знятим ручником. Голи розважали, а захист часом приєднувався до глядачів.",
    matches: (profile) => profile.verdict === "midTable" && profile.chaotic,
    priority: 5,
  },
  {
    en: "Few goals, few gifts, few reasons to panic. It was not box-office football, but the foundation held.",
    ua: "Мало голів, мало подарунків, мало причин для паніки. Не касове видовище, зате фундамент вистояв.",
    matches: (profile) =>
      profile.verdict === "midTable" && profile.lowScoringSolid,
    priority: 5,
  },
  {
    en: "A respectable finish with hints of something better. The team spent enough time looking upward to keep next season interesting.",
    ua: "Пристойний фініш із натяками на більше. Команда досить часто дивилася вгору, щоб наступний сезон не здавався формальністю.",
    matches: (profile) => profile.tier === "strongMidTable",
    priority: 4,
  },
  {
    en: "A season caught between ambition and reality: bright spells were there, but the table rarely rewards inconsistency.",
    ua: "Команда зависла між амбіціями й реальністю: місцями було цікаво, але таблиця не пробачає пауз у грі.",
    matches: (profile) => profile.tier === "midTable",
    priority: 3,
  },
  {
    en: "Too much talent for such an ordinary address in the table. The season promised progress and delivered a waiting room.",
    ua: "Забагато таланту для такої буденної адреси в таблиці. Сезон обіцяв поступ, а запропонував зал очікування.",
    matches: (profile) =>
      profile.verdict === "midTable" && profile.underachieving,
    priority: 6,
  },
  {
    en: "Survival was secured without elegance but with enough stubbornness. In this part of the table, style points remain fictional.",
    ua: "Виживання забезпечили без елегантності, зате з достатньою впертістю. У цій частині таблиці бали за стиль усе одно вигадані.",
    matches: (profile) => profile.tier === "survival",
    priority: 5,
  },
  {
    en: "The goalkeeper kept the trapdoor closed one save at a time. It was tense, untidy and ultimately enough.",
    ua: "Воротар тримав люк зачиненим сейв за сейвом. Було нервово, неохайно, але зрештою достатньо.",
    matches: (profile) =>
      profile.verdict === "relegation" && profile.eliteGoalkeeper,
    priority: 6,
  },
  {
    en: "The relegation battle exposed every loose bolt in the structure. There was effort, but the table prefers repairs to promises.",
    ua: "Боротьба за виживання показала кожен розхитаний болт у конструкції. Старання були, але таблиця цінує ремонт більше за обіцянки.",
    matches: (profile) => profile.tier === "relegation",
    priority: 4,
  },
  {
    en: "A squad built for calmer waters somehow found the emergency exit. Underachievement is the polite word; the table is less diplomatic.",
    ua: "Склад для спокійніших вод чомусь шукав аварійний вихід. Недовиконання — слово ввічливе, таблиця висловилася різкіше.",
    matches: (profile) =>
      profile.verdict === "relegation" && profile.underachieving,
    priority: 6,
  },
  {
    en: "Champions with authority. The squad found answers in every line and kept setting the pace when the pressure rose.",
    ua: "Чемпіони без зайвих запитань. Команда знаходила відповіді в кожній лінії та додавала саме тоді, коли зростав тиск.",
    matches: (profile) => profile.verdict === "championship" && profile.balanced,
  },
  {
    en: "The title was won on firepower. Every open game looked like an invitation for this attack to strike again.",
    ua: "Титул здобуто завдяки вогневій потужності. Кожен відкритий матч ставав запрошенням для атаки завдати нового удару.",
    matches: (profile) =>
      profile.verdict === "championship"
      && ["FW", "AM"].includes(profile.bestPosition),
  },
  {
    en: "A championship built from the back. The defensive unit gave the team a platform that rarely cracked.",
    ua: "Чемпіонство, побудоване від захисту. Оборонна лінія створила фундамент, який майже не давав тріщин.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.defense >= profile.attack,
  },
  {
    en: "The midfield owned the ball and the season. Control, tempo and timely acceleration turned a good side into champions.",
    ua: "Півзахист контролював і м'яч, і сезон. Темп та своєчасні прискорення перетворили хорошу команду на чемпіона.",
    matches: (profile) =>
      profile.verdict === "championship" && profile.midfield >= profile.attack,
  },
  {
    en: "The league table tells the story: this team handled the long campaign better than anyone else and finished as worthy champions.",
    ua: "Турнірна таблиця говорить сама за себе: ця команда краще за всіх витримала довгу дистанцію та заслужено стала чемпіоном.",
    matches: (profile) => profile.verdict === "championship",
  },
  {
    en: "European football is secured after a campaign with real attacking edge. The forwards supplied enough decisive moments to stay above the chasing pack.",
    ua: "Єврокубки здобуто завдяки гострій атаці. Нападники створили достатньо вирішальних моментів, щоб залишити переслідувачів позаду.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.attack >= profile.defense,
  },
  {
    en: "A wall in goal carried this team through the difficult weeks. It was not always spectacular, but it was resilient enough for Europe.",
    ua: "Стіна у воротах провела команду крізь найважчі тижні. Не завжди видовищно, зате достатньо надійно для єврокубків.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.bestPosition === "GK",
  },
  {
    en: "The engine room dictated the rhythm and delivered European qualification. This was a season won through control rather than chaos.",
    ua: "Середня лінія диктувала ритм і привела команду до єврокубків. Цей сезон виграли контролем, а не хаосом.",
    matches: (profile) =>
      profile.verdict === "europe" && profile.midfield >= profile.defense,
  },
  {
    en: "A balanced side earned a deserved European place. No single unit carried the whole load, and that consistency mattered.",
    ua: "Збалансована команда заслужено вийшла до єврокубків. Жодна лінія не тягнула весь тягар сама, і саме стабільність стала вирішальною.",
    matches: (profile) => profile.verdict === "europe" && profile.balanced,
  },
  {
    en: "European qualification is a fair reward for a competitive season. The squad stayed in the race and delivered when the margins tightened.",
    ua: "Єврокубкова путівка стала справедливою нагородою за конкурентний сезон. Команда залишалася в гонці та додавала, коли ціна помилки зростала.",
    matches: (profile) => profile.verdict === "europe",
  },
  {
    en: "Plenty of noise, not enough control. The attack entertained, but a vulnerable back line kept dragging the team toward mid-table.",
    ua: "Багато шуму, але замало контролю. Атака розважала, проте вразливий захист постійно тягнув команду до середини таблиці.",
    matches: (profile) => profile.verdict === "midTable" && profile.chaotic,
  },
  {
    en: "A solid but low-scoring campaign ended in mid-table. The team stayed competitive, though too many matches lacked a final touch.",
    ua: "Надійний, але малорезультативний сезон завершився в середині таблиці. Команда трималася в грі, та надто часто бракувало останнього дотику.",
    matches: (profile) => profile.verdict === "midTable" && profile.lowScoringSolid,
  },
  {
    en: "The midfield promised control but could not turn it into enough points. A respectable season drifted into anonymity.",
    ua: "Півзахист обіцяв контроль, але не перетворив його на достатню кількість очок. Пристойний сезон поступово став непомітним.",
    matches: (profile) =>
      profile.verdict === "midTable" && profile.midfield >= profile.attack,
  },
  {
    en: "There were good afternoons and too many forgettable ones. Mid-table feels fair for a squad that never found a long run of form.",
    ua: "Сезон без катастрофи, але й без афіші. Команда часом додавала барв, та таблиця запам'ятала передусім нестабільність.",
    matches: (profile) => profile.verdict === "midTable",
  },
  {
    en: "The goalkeeper kept the season alive longer than it deserved. Survival became the only headline as the goals refused to come.",
    ua: "Воротар тримав цей сезон живим довше, ніж він на те заслуговував. Коли голи не приходили, виживання стало єдиним заголовком.",
    matches: (profile) =>
      profile.verdict === "relegation" && profile.bestPosition === "GK",
  },
  {
    en: "The attack had moments of menace, but the team was far too open. Every push forward seemed to create another emergency at the back.",
    ua: "Атака часом була небезпечною, але команда грала надто відкрито. Майже кожен ривок уперед створював нову пожежу позаду.",
    matches: (profile) => profile.verdict === "relegation" && profile.chaotic,
  },
  {
    en: "A lack of depth caught up with the squad. The relegation fight exposed weak links that could not be hidden for 30 rounds.",
    ua: "Брак глибини складу наздогнав команду. Боротьба за виживання оголила слабкі місця, які неможливо було приховувати всі 30 турів.",
    matches: (profile) => profile.verdict === "relegation" && profile.weak,
  },
  {
    en: "Inconsistency defined the campaign and survival remained unresolved until the end. Too few players were able to change a difficult match.",
    ua: "Нестабільність визначила сезон, а питання виживання залишалося відкритим до кінця. Надто мало гравців могли перевернути складний матч.",
    matches: (profile) => profile.verdict === "relegation",
  },
];

const ukrainianSpecials: Array<{
  verdicts: SeasonVerdict[];
  text: string;
}> = [
  {
    verdicts: ["relegation"],
    text: "Таке чуство, шо нас бог наказує за шось. Мені так кажеться. Я, наверноє, знаю за шо, но я не можу вам сказати. Може у церкву сходити? Ми в церкву ходимо перед каждою ігрою. Перед каждою! Перед каждою ігрою ходимо в церкву! Перед каждою ігрою ходимо в церкву! Кому молитися? Перед каждою ігрою наша команда ходить в церкву! Перед каждою!, сказав один з гравців команди, підсумовуючи провальний сезон.",
  },
  {
    verdicts: ["relegation", "midTable"],
    text: "Треба грати агресивно і сильно, як робили на тренуваннях. Але що зробиш, якщо є болонки, є пуделі, а є вівчарки, підсумував невиразний сезон тренер команди.",
  },
  {
    verdicts: ["europe"],
    text: "Браво, Федерація, саркастично прокоментував цей сезон головний тренер клубу. Він явно вважає, що сумнівне суддівство стало на заваді боротьбі за чемпіонство.",
  },
  {
    verdicts: ["midTable"],
    text: "Будем розбиратися, все, що вдалося почути від тренера за підсумками сезону. Команда провела невиразний, сірий і нудний сезон, і надії на позитивні зміни мало.",
  },
  {
    verdicts: ["relegation"],
    text: "Пряма мова: - Що було, якби ми програли? Скажу як є. Всі ви знаєте, що таке гівно. Так от, у порівнянні з нашим життям воно було б повидлом. А тепер по грі.",
  },
  {
    verdicts: ["relegation", "midTable"],
    text: "Пряма мова: - Ми показали рівень колективу фізкультури. У міжсезонні мені запропонували 30 молодих хлопців. Двоє були непогані. Мені кажуть: беріть і поправте. Але я ж не Папа Карло, щоб свердлити і точити.",
  },
];

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function selectSeasonDescription(lineup: Lineup, result: SeasonResult) {
  const profile = teamProfile(lineup, result);
  const signature = Object.values(lineup)
    .map((player) => `${player.player_id}:${player.club_decade_id}`)
    .sort()
    .join("|");
  const matchingDefaults = defaults.filter((description) => description.matches(profile));
  const highestPriority = matchingDefaults.reduce(
    (highest, description) => Math.max(highest, description.priority ?? 0),
    0,
  );
  const defaultPool = matchingDefaults.length > 0
    ? matchingDefaults.filter(
      (description) => (description.priority ?? 0) === highestPriority,
    )
    : defaults;
  const english = defaultPool[hash(`en:${signature}:${result.verdict}`) % defaultPool.length].en;
  const suitableSpecials = ukrainianSpecials.filter((description) =>
    description.verdicts.includes(result.verdict),
  );
  const useSpecial = suitableSpecials.length > 0
    && hash(`special:${signature}:${result.points}`) % 4 === 0;
  const ukrainian = useSpecial
    ? suitableSpecials[hash(`ua-special:${signature}`) % suitableSpecials.length].text
    : defaultPool[hash(`ua:${signature}:${result.verdict}`) % defaultPool.length].ua;

  return { en: english, ua: ukrainian };
}
