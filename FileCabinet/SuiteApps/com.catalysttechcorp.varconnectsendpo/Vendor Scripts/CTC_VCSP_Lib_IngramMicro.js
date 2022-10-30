/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/search', 'N/xml', '../Library/CTC_VCSP_Constants.js', '../Library/CTC_Lib_Utils.js'], function (ns_search, ns_xml, constants, ctc_util) {
  const LogTitle = 'WS:Ingram';

  // TODO: GENERATE ACCESS TOKEN
  // const generateAccessToken = () => {
  //     let logTitle = [LogTitle, 'generateAccessToken'].join('::');

  // };

  function process (option) {
    var logTitle = [LogTitle, 'processResponse'].join('::');
    log.debug(logTitle, '>>Entry<<');

    var recPO = option.recPO;

    var imResponse = {
      recPoId: recPO.id,
      recPoType: recPO.type
    };

    imResponse.message = 'Testing Ingram';
    log.debug(logTitle, JSON.stringify(imResponse));

    return imResponse;
  }

  return {
    process: process
  };
});
