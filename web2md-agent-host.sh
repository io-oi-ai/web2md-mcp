#!/bin/bash
# Debug: log everything
exec 2>/tmp/web2md-bash-stderr.log
set -x
echo "bash started at $(date)" >> /tmp/web2md-bash-debug.log
echo "pwd=$(pwd)" >> /tmp/web2md-bash-debug.log
echo "uid=$(id)" >> /tmp/web2md-bash-debug.log
ls -la /opt/homebrew/bin/node >> /tmp/web2md-bash-debug.log 2>&1
/opt/homebrew/bin/node --version >> /tmp/web2md-bash-debug.log 2>&1
echo "about to exec node" >> /tmp/web2md-bash-debug.log
exec /opt/homebrew/bin/node "/Users/wuxichen/Desktop/I-Product/web-md/packages/mcp-server/dist/native-host.js"
