const optionExpansions = {
  DDL: 'DDL — Data Definition Language (язык определения данных)',
  DML: 'DML — Data Manipulation Language (язык манипулирования данными)',
  DCL: 'DCL — Data Control Language (язык управления доступом к данным)',
  TCL: 'TCL — Transaction Control Language (язык управления транзакциями)',
}

export function formatQuestionOption(option) {
  return optionExpansions[option] ?? option
}
