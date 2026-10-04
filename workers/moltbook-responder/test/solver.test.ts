import { isSchemaAsk, solveChallenge } from "../src/solver";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

// Real challenges captured from live Moltbook comments on 2026-09-29.
check(
  "live challenge 1 (23 gains 7)",
  solveChallenge(
    "A] lOoObSsTtEeR S^wImS[ aT/ tW~eNtY] tHrEe- cE^nTiMeTeRs/ pEr] sEcOnD- aNd^ gAiNs[ sEvEn/ cEnTiMeTeRs- pEr^ sEcOnD, aFtEr] mOlT/Ing- wHaT^ Is[ tHe- nEw/ spEeD?",
  ),
  "30.00",
);
check(
  "live challenge 2 (24 accelerates by 6)",
  solveChallenge(
    "A] lO.oB sT-ErRr LooObsTtErRr S^wImS[ aT/ TwEnTy] FoUr\\ cEmM]eTeRs- PeR/ sEcOnD~ AnD/ AcCeLeRaTeS| bY^ SiX, WhAtS{ ThE }nEw< VeLoOcItyyy?",
  ),
  "30.00",
);

check("digits", solveChallenge("A car moves at 23 km/h and gains 7 km/h. New speed?"), "30.00");
check(
  "split word: tWeN tY rejoins to twenty",
  solveChallenge(
    "A] lobster swims like um lobster velocity tWen tY tHrEe ]cm~tErS pEr\\ SeCoNd - accelerates by five + five, what is new velocity?",
  ),
  "33.00",
);
check("bare plus symbol", solveChallenge("A] cLaW- fOoRcE] iS^ ThIrTy] fIvE ] nOoOtOnS + tWeLlVe, HoW^ mUcH] ToTaL]?"), "47.00");
check("loses", solveChallenge("A] rObOt- mOvEs^ aT/ tHiRtY- mEtErS/ pEr] sEcOnD~ aNd^ lOoSeS- fOuR, wHaTs^ tHe[ nEw- sPeEd?"), "26.00");
check("doubles (unary)", solveChallenge("A] bEeAt- sItS^ aT/ fIfTy- bPm/ aNd^ dOuBlEs- wHaTs[ tHe- nEw/ tEmPo?"), "100.00");
check("three survives collapse", solveChallenge("a drone flies at three meters per second and gains nine, new speed?"), "12.00");
check("halves (unary)", solveChallenge("a] lOoP- rUnS^ aT/ sIxTy- bPm/ aNd^ hAlVeS- wHaTs^ tHe[ nEw- tEmPo?"), "30.00");
check("unsolvable returns null", solveChallenge("tell me about the weather tomorrow"), null);
check("word count cap: long schema mention is not an ask", isSchemaAsk("a1", "the constraint ladder schema is a clever design, genuinely"), false);
check("bare SCHEMA is an ask", isSchemaAsk("a1", "SCHEMA"), true);
check("schema please is an ask", isSchemaAsk("a1", "SCHEMA please!"), true);
check("can i get the schema is an ask", isSchemaAsk("a1", "Can I get the schema?"), true);
check("own comments are never asks", isSchemaAsk("34b4b124-2f87-4136-8bf2-198864394f5a", "SCHEMA"), false);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
