import { definePlugin } from 'nitro'

// Importing the environment validates it. Nitro loads this plugin when the
// server starts, so a missing variable stops the process at boot. Without it
// the first request would be the one to find out.
import './env'

export default definePlugin(() => {})
