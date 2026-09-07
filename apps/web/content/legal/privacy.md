---
title: Privacy Policy
lastUpdated: 2026-09-07
---

Short version: we hold the booking. Your card is held by Stripe, your sign-in is held by Clerk, and your uploaded files are held by Cloudflare R2. We do not sell anything to anyone, and we run no advertising or analytics trackers.

## Where your data actually lives

Four companies hold something between them, and it is worth knowing which holds what. Nothing in this table is a plan — it is the stack this product actually runs on today.

| What                 | Held by       | Why                                                        |
| -------------------- | ------------- | ---------------------------------------------------------- |
| Card details         | Stripe        | Taking the payment. These never reach an {{brand}} server. |
| Name, email, session | Clerk         | Signing you in and keeping you signed in.                  |
| Photos and files     | Cloudflare R2 | Vendor covers and portfolio images.                        |
| Bookings, messages   | {{brand}}     | The record of what was agreed, and the thread about it.    |
| Payout details       | Stripe        | Vendors only. Collected by Stripe Connect, not by us.      |

## What we collect from you

The account details you type in, the profile a vendor publishes, the requests and bookings you make, and the messages you send through the thread. Nothing else — there is no tracking pixel building a second profile of you in the background.

One exception, and it is worth naming: when you accept a legal document — these Terms when you first sign in, and the vendor agreement if you are a vendor — we record the moment, the person, the business where there is one, the version accepted, a fingerprint of the exact text you were shown, **the IP address the acceptance came from and the browser that sent it**. That is the record of an agreement rather than a profile of a person, and it is the one thing here we cannot later edit or remove — see _Your rights_.

## Why we are allowed to hold it

Because you asked us to run a booking for you, and a booking cannot be run without a record of it. Where we keep something after that, it is because tax and accounting law requires the record of a payment to survive the account that made it.

## Who else sees it

A vendor sees the requests and bookings addressed to them, and the messages you send them. A customer sees the profile a vendor published. Nobody sees anybody else's. Our processors — Stripe, Clerk and Cloudflare — see what the table above says they hold, and are contractually barred from doing anything else with it.

**One exception, and it is the reason reporting works at all: when a message thread is reported, the people who operate the platform can read it.** They can read that thread, and only that thread, and only while the report is open — a closed report stops being a key to the conversation. Every such read is written to an internal log naming the operator, the thread and the report it was read under. Staff never write into a thread: an operator reads and then acts, and nothing you see in a conversation is from us. We do not otherwise read your messages, and there is no way in the product for anybody to browse conversations they have no report about.

## How long we keep it

Messages and bookings stay for as long as the account does. Payment records outlive the account where the law requires it. Uploaded files are deleted when you delete them, and a closed account's profile stops being public immediately. Your record of accepting a legal document — including the address and browser it names — outlives the account too; see _Your rights_.

## Your rights

Ask us for a copy of what we hold, ask us to correct it, or ask us to delete it. Two things survive that, and we would rather say so than pretend otherwise: the payment records the law makes us keep, and your record of having accepted a legal document. That record is deliberately not editable and not removable, because an agreement either side can change afterwards is worth nothing to either side — and **closing your account does not remove it**, including the address and browser it names. What closing does remove is everything else. Requests go through Contact support.

## Security

Traffic is encrypted, card details never touch our servers, and access to the database is limited to the people who operate the platform. If something goes wrong with your data we will tell you, rather than wait to be asked.

## Changes and contact

The date at the top of this page is the date of the version you are reading. Questions go through Contact support, which reaches a person.

:::note
No advertising networks, no analytics vendors, no data brokers. If that ever changes we will say so here and ask you first.
:::
