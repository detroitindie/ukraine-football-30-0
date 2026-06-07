import type { DraftPlayer, Lineup } from "@/lib/draft-types";
import type { SeasonResult, SeasonVerdict } from "@/lib/seasonSimulation";

type TeamProfile = {
  verdict: SeasonVerdict;
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
};

type Description = {
  en: string;
  ua: string;
  matches: (profile: TeamProfile) => boolean;
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

  return {
    verdict: result.verdict,
    bestPosition: bestPlayer?.game_position ?? "",
    overall: average(players),
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
  };
}

const defaults: Description[] = [
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
    ua: "Були хороші матчі й надто багато таких, які хочеться забути. Середина таблиці справедлива для команди без тривалої серії форми.",
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
  const defaultPool = matchingDefaults.length > 0 ? matchingDefaults : defaults;
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
