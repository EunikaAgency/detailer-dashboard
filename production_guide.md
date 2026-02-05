# PUBLISH DEVELOPMENT BUILD TO PRODUCTION


Build new static site for production 

```
npm run build
```

Restart "detailer-web-prod" process manager (PM2) for production 

```
pm2 reload ecosystem.config.js --only detailer-web-prod --update-env
```