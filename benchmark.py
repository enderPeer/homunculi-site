"""Easy benchmark v1 (fixed 2026-10-01 before any model was run): 40 short questions, 8 areas x 5.
A reply passes when it contains one of the accepted answers (word match after lowercasing, digits spelled
out as well). Yes/no items pass only when the reply contains the right word and not the opposite one.
Greedy decoding (top_k 1), one try per question."""
import argparse, datetime, hashlib, json, re, sys, time, urllib.request
from pathlib import Path

H = "http://192.168.178.171"

ITEMS = [
    # area, question, accepted answers
    ("geography", "what is the capital of france?", ["paris"]),
    ("geography", "what is the capital of germany?", ["berlin"]),
    ("geography", "what is the capital of japan?", ["tokyo"]),
    ("geography", "what is the capital of italy?", ["rome"]),
    ("geography", "on which continent is egypt?", ["africa"]),
    ("science", "what planet do we live on?", ["earth"]),
    ("science", "what is the sun?", ["star"]),
    ("science", "what gas do plants take in from the air?", ["carbon dioxide", "co2"]),
    ("science", "what does the heart pump?", ["blood"]),
    ("science", "what is water made of?", ["hydrogen", "oxygen"]),
    ("animals", "how many legs does a spider have?", ["eight"]),
    ("animals", "what do bees make?", ["honey"]),
    ("animals", "what kind of animal is a whale?", ["mammal"]),
    ("animals", "what does a cow give us to drink?", ["milk"]),
    ("animals", "where do fish live?", ["water", "sea", "ocean", "river", "lake"]),
    ("everyday", "what colour is a banana?", ["yellow"]),
    ("everyday", "what is a spoon used for?", ["eat", "eating", "soup", "stir", "stirring"]),
    ("everyday", "what do you use an umbrella for?", ["rain"]),
    ("everyday", "where do you keep milk cold?", ["fridge", "refrigerator"]),
    ("everyday", "what do you wear on your feet?", ["shoe", "shoes", "socks", "sock", "boots"]),
    ("numbers", "what is two plus two?", ["four"]),
    ("numbers", "how many days are in a week?", ["seven"]),
    ("numbers", "what is ten minus three?", ["seven"]),
    ("numbers", "how many months are in a year?", ["twelve"]),
    ("numbers", "how many hours are in a day?", ["twenty four"]),
    ("money", "what is bitcoin?", ["digital currency", "cryptocurrency", "crypto currency", "digital money", "virtual currency"]),
    ("money", "what is inflation?", ["rise in prices", "rising prices", "price level", "prices rise", "increase in prices", "prices go up", "general rise", "general increase"]),
    ("money", "what does a central bank control?", ["money supply", "interest rate", "interest rates", "monetary policy", "inflation", "currency"]),
    ("money", "what is a stock?", ["share", "shares", "ownership", "company"]),
    ("money", "what is the currency of japan?", ["yen"]),
    ("history", "who wrote romeo and juliet?", ["shakespeare"]),
    ("history", "who painted the mona lisa?", ["leonardo", "da vinci"]),
    ("history", "who was the first president of the united states?", ["washington"]),
    ("history", "in what year did world war two end?", ["nineteen forty five", "nineteen hundred forty five", "one thousand nine hundred forty five"]),
    ("history", "who discovered gravity?", ["newton"]),
    ("yes or no", "is the sun a star? answer yes or no.", ["yes"]),
    ("yes or no", "is a whale a fish? answer yes or no.", ["no"]),
    ("yes or no", "is ice cold? answer yes or no.", ["yes"]),
    ("yes or no", "can a dog fly? answer yes or no.", ["no"]),
    ("yes or no", "is paris in france? answer yes or no.", ["yes"]),
]

ONES = "zero one two three four five six seven eight nine".split()
TEENS = "ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def spell(n):
    n = int(n)
    if n < 10: return ONES[n]
    if n < 20: return TEENS[n - 10]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 10000 and 1100 <= n < 2100:  # years
        return spell(n // 100) + " " + (spell(n % 100) if n % 100 else "hundred")
    return str(n)


def norm(text):
    text = text.lower().replace("-", " ")
    text = re.sub(r"\d+", lambda m: " " + spell(m.group()) + " ", text)
    return " " + re.sub(r"[^a-z0-9]+", " ", text).strip() + " "


def passes(q, reply, accepted):
    r = norm(reply)
    hit = any(" " + norm(a).strip() + " " in r for a in accepted)
    if q.endswith("answer yes or no."):
        other = " no " if accepted == ["yes"] else " yes "
        return hit and other not in r
    return hit


def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def homunculi(route, steps):
    return lambda q: post(f"{H}:8642/api/models/{route}/chat", {"prompt": q, "max_new_tokens": steps,
                          "temperature": 1.0, "top_k": 1, "seed": 1}).get("reply", "")


def haishool(port):
    return lambda q: post(f"{H}:{port}/api/ask", {"question": q}).get("answer", "")


BOTS = {
    "Homunculi Classic": homunculi("old", 300),     # character model: steps are letters
    "Homunculi A": homunculi("new", 80),            # token model: about 4.5 letters per step
    "Haishool": haishool(8650),
    "Haishool links explorer": haishool(8651),
    # Preserve the full response for audit, but score only its answer field.
    # verification.expected / expected_display are rule corrections, not model answers.
    "Haishool v5": lambda q: post(f"{H}:8652/api/ask", {"question": q}),
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=list(BOTS), help="Run just this model; questions and scorer are unchanged.")
    parser.add_argument("--out", type=Path, default=Path("/tmp/easybench.json"))
    args = parser.parse_args()
    if args.out.exists():
        parser.error("output already exists; preserve the recorded one-try run and choose a new destination")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    results = {"benchmark": "easy-v1", "items": [{"area": a, "q": q, "accepted": acc} for a, q, acc in ITEMS], "bots": {},
               "started_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "items_sha256": hashlib.sha256(json.dumps(ITEMS, separators=(",", ":")).encode()).hexdigest(),
               "answer_policy": "Score answer/reply only; never credit separate verification or rule corrections.",
               "status": "running"}
    selected = {args.only: BOTS[args.only]} if args.only else BOTS
    def save():
        temporary = args.out.with_suffix(args.out.suffix + ".tmp")
        temporary.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        temporary.replace(args.out)
    save()
    for name, ask in selected.items():
        rows = []
        results["bots"][name] = {"score": 0, "of": 0, "rows": rows}
        for area, q, acc in ITEMS:
            response, error = None, None
            try:
                response = ask(q)
                reply = (response.get("answer", "") if isinstance(response, dict) else response) or ""
            except Exception as e:
                error = str(e)
                reply = f"(error: {e})"
            rows.append({"area": area, "q": q, "reply": reply, "pass": passes(q, reply, acc),
                         "response": response, "error": error})
            results["bots"][name].update(score=sum(r["pass"] for r in rows), of=len(rows))
            save()
            time.sleep(0.3)
        score = sum(r["pass"] for r in rows)
        results["bots"][name] = {"score": score, "of": len(rows), "rows": rows}
        print(name, score, "/", len(rows), flush=True)
    results.update(status="completed", completed_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    save()
