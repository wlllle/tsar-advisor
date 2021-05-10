cmake_minimum_required(VERSION 3.4.3)

project(TSAR_ADVISOR VERSION 0.0.4 LANGUAGES)

set(TSAR_TEST_DESCRIPTION "TSAR Advisor")
set(TSAR_TEST_HOMEPAGE_URL "https://github.com/dvm-system/tsar-advisor ")

set(TSAR_ADVISOR_SOURCES html/style.css src/aliasTree.ts src/calleeFunc.ts
  src/extension.ts src/fileList.ts src/functions.ts src/general.ts src/log.ts
  src/loopExplorer.ts src/loopTree.ts src/messages.ts src/project.ts
  src/tools.ts src/transformProvider.ts src/webviewProvider.ts)

set(TSAR_ADVISOR_PACKAGE tsar-advisor-${TSAR_ADVISOR_VERSION}.vsix)

add_custom_command(OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/${TSAR_ADVISOR_PACKAGE}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  COMMAND npm install
  COMMAND vsce package
  DEPENDS ${TSAR_ADVISOR_SOURCES})

add_custom_target(tsar-advisor ALL COMMENT "Built TSAR Advisor"
  DEPENDS ${TSAR_ADVISOR_PACKAGE})

install(CODE "message(\"-- Installing extension ${TSAR_ADVISOR_PACKAGE}\")\n
  execute_process(COMMAND code --install-extension ${CMAKE_CURRENT_SOURCE_DIR}/${TSAR_ADVISOR_PACKAGE})")
