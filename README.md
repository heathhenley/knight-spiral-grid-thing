# Red / Black Knights - Numberphile 

This makes images procedurally according to the rules in this [Numberphile video](https://www.youtube.com/watch?v=UiX4CFIiegM)

Rules are roughly:
- you make a spiral grid starting at the center (0, 0)
- place a red knight on the next open cell, according to spiral, as long as it's not attacked by black
- place a black knight on the next open cell, according to spiral order, as long as it's not attacked by red

You can some really cool designs. The person who thought of it is [Jonas Karlsson](https://jonka364.github.io/),
a mathmetician I assume; you can regenerate the [images he posted here](https://jonka364.github.io/stendhal/stendhal.html)

I don't know why I made this other than I find the patterns that pop out really fascinating, the video blew my mind and I wanted to
see what other cool designs could pop out.

I wrote the engine just to feel something, but I vibe coded the controls and styling. Also used AI to get the closed form 2d
center reference coords to spiral index.

Here's a couple that I like:
- [5 colors](https://heathhenley.dev/knight-spiral-grid-thing/?size=4096&pieces=5&moves=Knight%2CAntelope%2CKnight%2CSatrap%2CZebra&attacks=2%2C3%2C4%2C5%7C1%2C3%2C4%2C5%7C1%2C2%2C4%2C5%7C1%2C2%2C3%2C5%7C1%2C2%2C3%2C4&colors=ff3333%2C3366ff%2C44aa00%2Cffaa00%2Caa55ff)
- [from Jonas' examples](http://localhost:5174/?size=1024&pieces=2&moves=Knight%2CAntelope&attacks=2%7C1&colors=d51024%2C13c8ec)
- [i like the repeating squares](https://heathhenley.dev/knight-spiral-grid-thing/?size=4096&pieces=3&moves=Knight%2CAntelope%2CEland&attacks=2%7C1%7C1%2C2&colors=ff3333%2C3366ff%2C44aa00)
