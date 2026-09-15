# Vendor Marketplace

A marketplace where customers book event vendors — photographers, DJs, makeup
artists, decorators, caterers and florists. Vendors offer preset packages with
clear prices, reviews come only from real bookings, and payment and messaging
happen inside each booking.

## Run it on your computer

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (the
   program that runs the app's database) and open it.
2. Install Node 22.22.2 or newer (the engine the app runs on) with the LTS
   installer from [nodejs.org](https://nodejs.org).
3. Open Terminal (the app where you type commands: press Cmd-Space and type
   "Terminal") and run this once, to switch on the pnpm tool:
   ```
   corepack enable
   ```
   If it says `permission denied`, run `sudo corepack enable` and type your Mac password.
4. Get the code. If your Mac asks to install developer tools, click Install and
   run the command again. Then move into the folder:
   ```
   git clone https://github.com/hmalik-dev/vendor-marketplace.git
   ```
   ```
   cd vendor-marketplace
   ```
5. Put the `.env` file you were given (a settings file holding the app's keys)
   in the `vendor-marketplace` folder. It is the only file you need.
6. Start the app. The first run takes a few minutes:
   ```
   pnpm start
   ```
7. When the messages stop scrolling, open http://localhost:3000 in your browser.
8. To stop the app, press Ctrl-C in Terminal or close the window. To start it
   again later, including after getting new code with `git pull`: open Docker Desktop, open
   Terminal, move into the folder with `cd vendor-marketplace`, and run
   `pnpm start`. It is the same command every time.

### If you see…

| Message                                                 | What to do                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `command not found: pnpm`                               | Run `corepack enable` (step 3), then try again.                                 |
| `The app needs Node …`                                  | Install Node from [nodejs.org](https://nodejs.org), open a new Terminal window. |
| `Docker is not running`                                 | Open Docker Desktop, wait for the whale icon in the menu bar, then try again.   |
| `The app will not start until these keys …`             | Ask the project owner for the `.env` file and put it in the folder (step 5).    |
| `port is already allocated` or `address already in use` | The app is already running in another Terminal window: close that one first.    |

Developers: see [docs/development.md](docs/development.md).
