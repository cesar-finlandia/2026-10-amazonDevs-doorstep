# Doorstep Rhythm

Know her day without calling.

Doorstep Rhythm is a web app for the daughter who lives far from her mum. It reads the week at the front door of a sample household through the Ring APIs, learns what an ordinary day looks like there, and circles the one moment that did not fit.

## What it does

- Reads a week of doorstep events from Ring: motion, button presses and device status. Signed webhooks bring new events in, and Event History fills the gaps when a webhook goes missing.
- Draws the week as a paper calendar with every visit marked, next to a plain timeline for large type and screen readers.
- Starts a review on Amazon Bedrock through the Strands Agents SDK. The agent works through a fixed list of actions, and every step it takes is listed on screen as it happens.
- Checks the agent's work with a truth engine written in code, and sends the agent back to repair whatever the engine rejects.
- Stops at a checkpoint. Marta, the caretaker, presses Approve or Reject before any message leaves the app.
- Stands the same week up in three dimensions, so the circled moment can be seen from the door.

## How it uses Ring

Every Ring call goes through one port with two faces: a live one that calls the Ring APIs, and a recorded sample week. The live face covers device discovery, status, capabilities, Event History, signed webhooks, image snapshots, short clips and live sessions over WHEP. The page says plainly which face it is showing.

## Try it

The live page needs no sign-in. Press Load the sample week, then Review the week. To read a real account, paste a Ring Developer Playground token on the same page.

## Reused code and AI help

The reused scaffolding and every AI tool that helped are listed in `disclosure.md` in the repository.
