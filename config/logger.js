import winston from "winston";
const { format, transports } = winston;

const logFormat = format.printf((info) => {
  let isJson = false;
  try {
    JSON.stringify(info.message);
    isJson = true;
  } catch (e) {
    isJson = false;
  }

  if (!isJson) {
    return `${info.timestamp} ${info.level}: ${(info.message)}`;
  } else {
    return `${info.timestamp} ${info.level}:\n${JSON.stringify(
      info.message,
      null,
      4
    )}`;
  }
});

function filterOnly(level) {
  return format(function (info) {
    if (info[LEVEL] === level) {
      return info;
    }
  })();
}

winston.addColors({
  silly: 'blue',
  warn: 'yellow',
  error: 'red'
});

const logger = winston.createLogger({
  levels: {
    silly: 0,
    warn: 1,
    error: 2
  },
  level: 'error',
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json()
  ),
  defaultMeta: { service: "user-service" },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), logFormat),
    }),
    new winston.transports.File({ filename: "./logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "./logs/link_missing.log", level: "warn" }),
    new winston.transports.File({ filename: "./logs/page_count.log", level: "silly" }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: './logs/exceptions.log' })
  ]
});


export default logger;

export function LogGreen(message){
  console.log('\x1b[32m', message); 
  console.log('\x1b[0m');  //yellow
}

export function LogYellow(message){
  console.log('\x1b[33m', message); 
  console.log('\x1b[0m');  //yellow
}

export function LogMagenta(message){
  console.log('\x1b[35m', message); 
  console.log('\x1b[0m');  //yellow
}

export function LogCyan(message){
  console.log('\x1b[36m', message); 
  console.log('\x1b[0m');  //yellow
}
