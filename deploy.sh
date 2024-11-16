#!/bin/bash
cd /home/timer/timer.lyamin.org
git pull
npm install
pm2 restart timer 