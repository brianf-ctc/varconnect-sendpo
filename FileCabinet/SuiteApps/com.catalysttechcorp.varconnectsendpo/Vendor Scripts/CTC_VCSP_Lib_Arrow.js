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
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @description Library File for Arrow PO Creation
 */

/**
 * Project Number:
 * Script Name: CTC VCSP Lib Arrow
 * Author: john.ramonel
 */
define([
    'N/runtime',
    'N/format',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_Lib_Utils'
], function (NS_Runtime, NS_Format, VCSP_Global, CTC_Util) {
    'use strict';

    const LogTitle = 'WS:Arrow';
    let CURRENT = {};

    let LibArrowAPI = {
        generateToken: function (option) {
            let logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            let Config = CURRENT.Config,
                url = Config.accessEndPoint,
                apiKey = Config.apiKey,
                apiSecret = Config.apiSecret;
            if (Config.testRequest) {
                url = Config.qaAccessEndPoint;
                apiKey = Config.qaApiKey;
                apiSecret = Config.qaApiSecret;
            }

            let tokenReq = CTC_Util.sendRequest({
                header: [LogTitle, 'Generate Token'].join(' '),
                method: 'post',
                recordId: CURRENT.recordId,
                doRetry: true,
                maxRetry: 3,
                query: {
                    url: url,
                    body: CTC_Util.convertToQuery({
                        client_id: apiKey,
                        client_secret: apiSecret,
                        scope: ['api://', apiKey, '/.default'].join(''),
                        grant_type: 'client_credentials'
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            });

            CTC_Util.handleJSONResponse(tokenReq);
            let tokenResp = tokenReq.PARSED_RESPONSE;
            if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

            returnValue = tokenResp.access_token;
            CURRENT.accessToken = tokenResp.access_token;

            return returnValue;
        },
        sendOrder: function (option) {
            let logTitle = [LogTitle, 'sendOrder'].join('::');
            option = option || {};

            let sendPOResponse = CTC_Util.sendRequest({
                header: [LogTitle, 'Send Order'].join(' '),
                method: 'post',
                recordId: CURRENT.recordId,
                query: {
                    url: CURRENT.Config.testRequest
                        ? CURRENT.Config.qaEndPoint
                        : CURRENT.Config.endPoint,
                    body: JSON.stringify(CURRENT.payloadObj),
                    headers: {
                        Authorization: 'Bearer ' + CURRENT.accessToken,
                        Accept: 'application/json',
                        'Ocp-Apim-Subscription-Key': CURRENT.Config.testRequest
                            ? CURRENT.Config.qaSubscriptionKey
                            : CURRENT.Config.subscriptionKey,
                        'Content-Type': 'application/json'
                    }
                }
            });
            log.audit(logTitle, '>> Arrow: ' + JSON.stringify(sendPOResponse));
            return sendPOResponse;
        },
        validateResponse: function (parsedResponse) {
            if (!parsedResponse) throw 'Unable to read the response';
            let hasErrors, errorMsgs;

            if (!parsedResponse.TransactionStatus || parsedResponse.TransactionStatus == 'ERROR') {
                hasErrors = true;
                errorMsgs = parsedResponse.TransactionMessage;
            }

            if (hasErrors && errorMsgs) throw errorMsgs;
            return true;
        }
    };

    var Helper = {
        truncateStr: function (strVal, maxLen) {
            return strVal.length > maxLen ? strVal.substring(0, maxLen - 3) + '...' : strVal;
        },
        generateAddress: function (addrObj, mapping) {
            var returnValue = {};

            for (var fld in mapping) {
                var mappedFld = mapping[fld];
                if (mappedFld.match(/email/gi)) {
                    returnValue[fld] = addrObj[mappedFld];
                } else {
                    returnValue[fld] = Helper.truncateStr(addrObj[mappedFld] || '', 30);
                }
            }

            return returnValue;
        },
        formatToArrowDate: function (dateToFormat) {
            let logTitle = [LogTitle, 'formatToArrowDate'].join('::'),
                formattedDate = '';
            if (dateToFormat && dateToFormat instanceof Date) {
                // yyyymmdd
                formattedDate = [
                    Helper.padDigits(dateToFormat.getFullYear(), 2),
                    Helper.padDigits(dateToFormat.getMonth() + 1, 2),
                    Helper.padDigits(dateToFormat.getDate(), 2)
                ].join('');
            }
            return formattedDate;
        },

        padDigits: function (number, digits) {
            return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
        },

        formatArrowPOType: function (strPoType) {
            let logTitle = [LogTitle, 'formatArrowPOType'].join('::');
            let option = {};
            if (strPoType == 'Drop Shipment') {
                option.poType = 'DS';
                option.fobCode = 'ORIGIN';
            } else {
                option.poType = 'SA';
                option.fobCode = 'DESTINATION';
            }

            return option;
        }
    };

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object}
     * @description option.poObj = contains the Actual PO option from NetSuite, option.vendorConfig = VAR Connect Vendor Config Fields
     * @returns object
     **/

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::');

        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        log.audit(logTitle, '// Vendor COnfig: ' + JSON.stringify(vendorConfig));
        log.audit(logTitle, '// PO Obj: ' + JSON.stringify(poObj));

        var requestBody = {
            PurchaseOrder: {
                HeaderRec: {
                    TransactionType: 'RESELLER_PO_CREATE',
                    SourceTransactionKeyID: [
                        'NS' + NS_Runtime.accountId,
                        CURRENT.Record.getValue({ fieldId: 'transactionnumber' }),
                        poObj.id
                    ].join('_'), // use the PO ID and PO Number

                    RequestTimestamp: NS_Format.format({
                        value: new Date(),
                        type: NS_Format.Type.DATETIME
                    }),

                    Region: 'NORTH_AMERICAS',
                    Country: 'US', // TODO: get data from subsidiary
                    PartnerID: CURRENT.Config.customerNo
                    // PartnerName: null, // 'PartnerName7',
                    // OrgID: 'OrgID8',
                    // BatchID: 'BatchID9',
                    // FlowID: 'FlowID10',
                    // SourceSystem: 'System Name',
                    // AFS: 'EBS'
                },
                poDetails: [
                    {
                        CustPoNumber: poObj.tranId,
                        ArrowQuote: {
                            ArrowQuoteNumber: (function () {
                                var returnValue;

                                // custbody_ctc_vcsp_vendor_quote_num
                                // custcol_ctc_vcsp_quote_no

                                var vendorQuote = {
                                    vcBody: CURRENT.Record.getValue({
                                        fieldId: 'custbody_ctc_vcsp_vendor_quote_num'
                                    }),
                                    vcCol: CURRENT.Record.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_ctc_vcsp_quote_no',
                                        line: 0
                                    }),
                                    custBody: !CURRENT.Config.quoteColumn
                                        ? null
                                        : CURRENT.Config.quoteColumn.match(/^custbody/gi)
                                        ? CURRENT.Record.getValue({
                                              fieldId: CURRENT.Config.quoteColumn
                                          })
                                        : null,
                                    custCol: !CURRENT.Config.quoteColumn
                                        ? null
                                        : CURRENT.Config.quoteColumn.match(/^custcol/gi)
                                        ? CURRENT.Record.getSublistValue({
                                              sublistId: 'item',
                                              fieldId: CURRENT.Config.quoteColumn,
                                              line: 0
                                          })
                                        : null
                                };

                                log.audit(
                                    logTitle,
                                    '// quote column ? ' + JSON.stringify(vendorQuote)
                                );

                                var quoteNum =
                                    vendorQuote.vcBody ||
                                    vendorQuote.vcCol ||
                                    vendorQuote.custBody ||
                                    vendorQuote.custCol;

                                return quoteNum;
                            })()
                            // ArrowQuoteVersion: 'ArrowQuoteVersion15',
                            // ArrowQuoteLineNum: 'ArrowQuoteLineNum16'
                        },
                        CustPoType: 'DS',
                        PoDate: Helper.formatToArrowDate(
                            NS_Format.parse({
                                value: poObj.tranDate,
                                type: NS_Format.Type.DATE
                            })
                        ),
                        Comments: poObj.vendorNotes || poObj.memo || null,
                        // TotalPOPrice: poObj.total,
                        TotalPOPrice: (function () {
                            var totalPrice = 0;
                            for (let i = 0, j = poObj.items.length; i < j; i++) {
                                var lineData = poObj.items[i];
                                totalPrice +=
                                    CTC_Util.forceFloat(lineData.rate) *
                                    CTC_Util.forceFloat(lineData.quantity);
                            }
                            return CTC_Util.roundOff(totalPrice);
                        })(),

                        PoCurrency: 'USD',
                        FobCode: 'ORIGIN',
                        ShipViaCode: 'ZZ',
                        ShipViaDescription: 'ELECTRONIC DISTRIBUTION',
                        SoldTo: (function () {
                            var addrObj = CURRENT.Config.Bill;
                            return {
                                SoldToName: Helper.truncateStr(addrObj.attention, 30),
                                SoldToAddrLine1: Helper.truncateStr(addrObj.address1, 30),
                                SoldToAddrLine2: Helper.truncateStr(addrObj.address2, 30),
                                SoldToCity: Helper.truncateStr(addrObj.city, 30),
                                SoldToState: Helper.truncateStr(addrObj.state, 30),
                                SoldToZip: Helper.truncateStr(addrObj.zip, 30),
                                SoldToCountry: Helper.truncateStr(addrObj.country, 30),
                                SoldToContactName: Helper.truncateStr(addrObj.addressee, 30),
                                SoldToContactPhone: Helper.truncateStr(addrObj.phoneno, 30),
                                SoldToContactEmail: addrObj.email
                            };
                        })(),

                        BillTo: (function () {
                            var addrObj = CURRENT.Config.Bill;
                            return {
                                BillToName: Helper.truncateStr(addrObj.attention, 30),
                                BillToAddrLine1: Helper.truncateStr(addrObj.address1, 30),
                                BillToAddrLine2: Helper.truncateStr(addrObj.address2, 30),
                                BillToCity: Helper.truncateStr(addrObj.city, 30),
                                BillToState: Helper.truncateStr(addrObj.state, 30),
                                BillToZip: Helper.truncateStr(addrObj.zip, 30),
                                BillToCountry: Helper.truncateStr(addrObj.country, 30),
                                BillToContactName: Helper.truncateStr(addrObj.addressee, 30),
                                BillToContactPhone: Helper.truncateStr(addrObj.phoneno, 30),
                                BillToContactEmail: addrObj.email
                            };
                        })(),

                        ShipTo: (function () {
                            var addrObj = poObj;

                            return {
                                ShipToName: Helper.truncateStr(addrObj.shipAddressee, 30),
                                ShipToAddrLine1: Helper.truncateStr(addrObj.shipAddr1, 30),
                                ShipToAddrLine2: Helper.truncateStr(addrObj.shipAddr2, 30),
                                ShipToCity: Helper.truncateStr(addrObj.shipCity, 30),
                                ShipToState: Helper.truncateStr(addrObj.shipState, 30),
                                ShipToZip: Helper.truncateStr(addrObj.shipZip, 30),
                                ShipToCountry: Helper.truncateStr(addrObj.shipCountry, 30),
                                ShipToContactName: Helper.truncateStr(
                                    addrObj.shipAttention ||
                                        addrObj.shipAddressee ||
                                        addrObj.shipContact,
                                    30
                                ),
                                ShipToContactPhone: Helper.truncateStr(addrObj.shipPhone, 30),
                                ShipToContactEmail: addrObj.shipEmail
                            };
                        })(),

                        EndUser: (function () {
                            var addrObj = poObj;

                            return {
                                EndUserName: Helper.truncateStr(addrObj.shipAddressee, 30),
                                EndUserAddrLine1: Helper.truncateStr(addrObj.shipAddr1, 30),
                                EndUserAddrLine2: Helper.truncateStr(addrObj.shipAddr2, 30),
                                EndUserCity: Helper.truncateStr(addrObj.shipCity, 30),
                                EndUserState: Helper.truncateStr(addrObj.shipState, 30),
                                EndUserZip: Helper.truncateStr(addrObj.shipZip, 30),
                                EndUserCountry: Helper.truncateStr(addrObj.shipCountry, 30),

                                EndUserContactName: Helper.truncateStr(
                                    poObj.EndUserContactName ||
                                        addrObj.shipAttention ||
                                        addrObj.shipAddressee ||
                                        addrObj.shipContact,
                                    30
                                ),
                                EndUserContactPhone: Helper.truncateStr(addrObj.shipPhone, 30),
                                EndUserContactEmail: addrObj.shipEmail
                            };
                        })(),

                        poLines: (function () {
                            var poLines = [];
                            for (let i = 0, j = poObj.items.length; i < j; i++) {
                                var lineData = poObj.items[i];

                                log.audit(logTitle, '// line data: ' + JSON.stringify(lineData));

                                poLines.push({
                                    CustPoLineItemNbr: i + 1,
                                    VendorPartNum: lineData.item || null,
                                    PartDescription: lineData.description || null,
                                    QtyRequested: lineData.quantity || null,
                                    UnitPrice: lineData.rate || 0,
                                    TotalPoLinePrice: lineData.amount || 0,
                                    MfgName: lineData.manufacturer || null,
                                    UnitOfMeasure: 'EA',
                                    EndUserPoNumber: poObj.endUserPONum || poObj.tranId
                                });
                            }

                            return poLines;
                        })()
                    }
                ]
            }
        };

        log.debug(logTitle, '>> Arrow Template Object: ' + JSON.stringify(requestBody));
        CTC_Util.vcLog({
            title: [LogTitle, 'SendPO Payload'].join(' - '),
            content: requestBody,
            transaction: poObj.id
        });

        return requestBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} option
     * @returns object
     **/
    function processRequest(option) {
        let logTitle = [LogTitle, 'processRequest'].join('::');

        LibArrowAPI.generateToken();
        if (!CURRENT.accessToken) throw 'Unable to generate access token';

        let sendPOResponse = LibArrowAPI.sendOrder(option);

        if (sendPOResponse.isError) throw sendPOResponse.errorMsg;
        CTC_Util.handleJSONResponse(sendPOResponse);
        LibArrowAPI.validateResponse(sendPOResponse.PARSED_RESPONSE);

        return sendPOResponse;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} option
     * @returns object
     **/
    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = option.returnResponse,
            responseBody = option.responseBody || returnValue.responseBody;
        if (responseBody) {
            returnValue.message = 'Send PO successful';
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let sendPOResponse,
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id
            };

        try {
            CURRENT.recordId = poObj.id;
            CURRENT.Config = vendorConfig;
            CURRENT.Record = option.transaction;

            let requestBody = generateBody({
                purchaseOrder: poObj,
                vendorConfig: vendorConfig
            });
            CURRENT.payloadObj = requestBody;

            sendPOResponse = processRequest({
                payload: requestBody,
                vendorConfig: vendorConfig,
                purchaseOrder: poObj
            });

            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id,
                logId: sendPOResponse.logId,
                responseBody: sendPOResponse.PARSED_RESPONSE || sendPOResponse.RESPONSE.body,
                responseCode: sendPOResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: poObj.id,
                errorName: null,
                errorMsg: null
            };

            returnResponse = processResponse({
                purchaseOrder: poObj,
                responseBody: returnResponse.responseBody,
                returnResponse: returnResponse
            });
        } catch (e) {
            log.error(logTitle, 'FATAL ERROR:: ' + e.name + ': ' + e.message);
            returnResponse = returnResponse || {};
            returnResponse.isError = true;
            returnResponse.error = e;
            returnResponse.errorId = poObj.id;
            returnResponse.errorName = e.name;
            returnResponse.errorMsg = e.message;
            if (sendPOResponse) {
                returnResponse.logId = sendPOResponse.logId || null;
                returnResponse.responseBody = sendPOResponse.PARSED_RESPONSE;
                if (sendPOResponse.RESPONSE) {
                    if (!returnResponse.responseBody) {
                        returnResponse.responseBody = sendPOResponse.RESPONSE.body || null;
                    }
                    returnResponse.responseCode = sendPOResponse.RESPONSE.code || null;
                }
            }
        } finally {
            log.audit(logTitle, '>> sendPoResp: ' + JSON.stringify(returnResponse));
        }
        return returnResponse;
    }

    return {
        process: process
    };
});
