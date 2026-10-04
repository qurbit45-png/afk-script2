function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    let leaveTimer = null;
    let jumpTimer = null;
    let jumpOffTimer = null;
    let reconnectTimer = null;

    let stopped = false;
    let reconnectAttempts = 0;
    let lastLogAt = 0;

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now();
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now;
            console.log(msg);
        }
    }

    function cleanup() {
        stopped = true;
        if (leaveTimer) clearTimeout(leaveTimer);
        if (jumpTimer) clearTimeout(jumpTimer);
        if (jumpOffTimer) clearTimeout(jumpOffTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        leaveTimer = jumpTimer = jumpOffTimer = reconnectTimer = null;
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return;

        bot.setControlState('jump', true);
        jumpOffTimer = setTimeout(() => {
            bot.setControlState('jump', false);
        }, 300);

        const nextJump = randomMs(20000, 5 * 60 * 1000);
        jumpTimer = setTimeout(scheduleNextJump, nextJump);
    }

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        cleanup();
        stopped = false;

        const stayTime = randomMs(60000, 300000);
        logThrottled(`[AFK] Will stay for ${Math.round(stayTime / 1000)} seconds`);

        scheduleNextJump();

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            logThrottled('[AFK] Leaving server (cycle timer)');
            cleanup();
            try {
                bot.quit();
            } catch (e) {}
        }, stayTime);
    });

    bot.on('end', () => { cleanup(); });
    bot.on('kicked', () => { cleanup(); });
    bot.on('error', () => { cleanup(); });
}

module.exports = setupLeaveRejoin;
