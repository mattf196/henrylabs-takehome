# README
(Note that THIS document contains no AI, this is just me writing about the app, and where I queried AI)

## 1 Getting started (primarily with bun)
Most of my use of AI to begin building this app was just me querying claude code (no agent/code writing, just asking) with some clarifying questions about bun (since ive never used it before) as well as getting a general overview (more in depth than whats given in the notion docs, though) of the payments SDK.

## 2 Building out FE infra
I used claude a lot for this, and while I wasn't going for anything crazy on the FE, I made sure to optimize at least somewhat for UX.
AI is pretty good at this stuff, and claude was pretty receptive to handle any UX ideas I threw at it.
This definitely isn't a final product for the FE, but I believe it works well for the task at hand.

## 3 Moving on to Checkout Flow
This was definitely a bit tricky at first, but after combing over the payments SDK first on my own to get a good idea of how checkout failure occured, I just asked claude for a quick overview on it. Finally, I settled on having the server automatically retry on 503s, just waiting for a webhook on 202s, and any combination of these while simply displaying loading on the FE.

We notify the user of fraud if it is detected, but do not specify why.

### 3.1 NOTE ON FRAUD/CHECKOUT

We could have a "Try Again" that generates a new customerId everytime a customer clicks it, in order to get the fraud counter down and make for better UX. With fraud increasing a lot with each duplicate record of the same items, fraud is going to skyrocket for a false positive. However, in practice, this is not a good thing to do, as this would be a massive security vulnerabilty in a production system if we handled fraud like this (not by maintaining a record of which items recorded fraud necesairally, but by directly helping the client circumvent this)

For this reason, I didn't try to wrestle with "false positives" (frauds with small amounts), even though I am cognizant that there is a way to circumvent this to get better UX.

## 4 Checkout Analytics
I had a good idea of how the checkout failure worked and what I was doing to ensure good user UX, but I got curious as to how "unreliable" the checkout actually was, both without any UX provisions taken and with provisions taken. I had claude write a script based on my specifications, using data from the SDK itself (a lot of this is just boilerplate stats anyways)

## 5 Final Remarks
These CX/UX problems are fun to think about! There are some decisions I made that didn't make it to here, but this doc is just a general guide of how I approached this problem. I don't think this is bug proof in any way, so please contact me if you have any further questions about my implementation. Thanks!



# Setup

bun install
bun run dev:server   # terminal 1
bun run dev:frontend # some separate terminal 2

