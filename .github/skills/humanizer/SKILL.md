---
name: humanizer
description: "Use this skill on every new or revised blog post before it is considered done. It removes AI-tell patterns and enforces a warm, human, practitioner voice. Trigger phrases: 'write a blog post', 'draft an article', 'humanize this draft', 'make this sound human'. Always run this as the final pass on generated blog content."
version: 1.0.0
author: russrimm
tags: [writing, tone, editing, voice, blogging]
license: MIT
---

# Humanizer

## Overview
The Humanizer is a mandatory tone pass for blog content. Its job is to make generated prose read like a human practitioner wrote it—warm, direct, specific, and free of the tells that mark AI text. Run it as the final step whenever a post is drafted or substantially revised, before the piece is considered done.

## When to Use
- Any time a new blog post is drafted from a topic, outline, or notes
- After a structural or length edit that rewrote large sections
- When a user says a draft "sounds like AI," "sounds robotic," or "sounds corporate"
- Before marking any post ready for review or publish

## When NOT to Use
- Code blocks, commands, cmdlets, API shapes, and config (leave technical content exact)
- Direct quotes and cited source text (do not paraphrase quoted material)
- Frontmatter values that must match a schema

## Core rule
Humanized tone is mandatory. If a sentence could have come from a marketing page or a generic AI assistant, rewrite it in Russ's practitioner-to-practitioner voice.

## Patterns to apply
1. **Lead with the reader's problem** — open on a real situation, not "In today's fast-paced world."
2. **Active voice** — "We changed the scope" not "The scope was changed."
3. **Second person** — address the reader as "you," speak as "I" from real experience.
4. **Vary sentence length** — mix short and medium sentences; avoid a wall of same-length clauses.
5. **Be specific, not vague** — name the product, version, portal path, or exact behavior instead of gesturing at it.
6. **Admit limits honestly** — "I'm not certain this survives the next release" beats false confidence.
7. **Conversational connectors** — "That said," "Here's the catch," "Quick note:" instead of "Additionally," "Furthermore," "Moreover."
8. **Earn every emphasis** — bold, italics, and exclamation points must carry weight; default to none.
9. **Concrete closes** — end on a real next step or honest takeaway, never "In conclusion" filler.
10. **Keep the author's specifics** — preserve real examples, hard-won details, and personality; do not sand prose into generic polish.

## Anti-patterns to strip
- ❌ Throat-clearing openers: "In today's fast-paced world," "As we all know," "In the ever-evolving landscape of…"
- ❌ Marketing hype: "game-changing," "powerful," "seamless," "unlock," "supercharge," "revolutionary."
- ❌ Empty transitions: "Additionally," "Furthermore," "Moreover," "It is worth noting that."
- ❌ AI hedging boilerplate: "It's important to note," "There are several factors to consider," "By leveraging…"
- ❌ Formulaic structure: rhetorical-question headings, "Let's dive in," "In conclusion," symmetrical "on one hand / on the other hand."
- ❌ Passive voice used to sound authoritative: "It has been determined that…"
- ❌ Em dashes as a crutch — use them sparingly and deliberately.
- ❌ Overused triads and parallelism ("fast, simple, and reliable") when one concrete claim would do.
- ❌ Fabricated stats, quotes, customer outcomes, or Microsoft announcements.
- ❌ Excessive emoji or bold; robotic sign-offs.

## Working method
1. Draft or edit the post per the `blog-post` skill and the Technical Blog Writer & Editor voice guidance.
2. Read the full draft once for AI tells using the anti-pattern list above.
3. Rewrite flagged sentences in Russ's voice; keep technical substance and real specifics intact.
4. Confirm the opening leads with the reader's problem and the close gives a real next step.
5. Verify no fabricated facts were introduced during rewriting; flag anything unverifiable for the author.

## Definition of done
A draft passes the Humanizer when:
- No opener, transition, or close matches the anti-pattern list.
- Voice reads practitioner-to-practitioner: active, specific, honest, occasionally wry.
- Emphasis, emoji, and em dashes are used deliberately, not as filler.
- Technical content, quotes, and specifics are unchanged and accurate.
