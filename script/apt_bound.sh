#!/usr/bin/env bash
# GitHub's ubuntu-24.04 image lists Azure first. A stalled fetch of
# noble-updates from azure.archive.ubuntu.com held the browser job for the
# rest of the 10 minute cap (run 41253712514, shards 4 and 5, 588s).
# archive.ubuntu.com had already answered. Bound the wait and drop Azure
# before Playwright runs apt for Chromium's libraries.
set -euo pipefail
sudo tee /etc/apt/apt.conf.d/99ci-timeout >/dev/null <<'EOF'
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::ftp::Timeout "20";
Acquire::Retries "3";
EOF
if [ -f /etc/apt/apt-mirrors.txt ]; then
  sudo sed -i 's|http://azure.archive.ubuntu.com|https://archive.ubuntu.com|g' /etc/apt/apt-mirrors.txt
fi
sudo find /etc/apt -type f \( -name '*.list' -o -name '*.sources' -o -name 'sources.list' \) -print0 |
  xargs -0 -r sudo sed -i 's|http://azure.archive.ubuntu.com|https://archive.ubuntu.com|g'
