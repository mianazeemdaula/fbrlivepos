/**
 * FBR DI Sale Type Configuration
 * Based on PRAL DI API v1.12 — fbr-cascade-spec.md §3
 */

export interface SaleTypeConfig {
    id: string           // SN001 … SN028
    scenarioId: string   // sandbox scenarioId (same as id in most cases)
    label: string        // exact saleType value for FBR payload (case-sensitive)
    transTypeId: number  // input to /SaleTypeToRate API
    requiresSRO: boolean // show SRO dropdown
    requiresSR: boolean  // show SR# dropdown
    showFT: boolean      // show Further Tax fields
    showFED: boolean     // show FED fields
    showEXT: boolean     // show Extra Tax fields
    showEXMT: boolean    // show Exempt checkbox
    taxBase: 'value' | 'retailPrice' | 'zero'
    uomLocked: string | null // forced UOM override; null = derive from HS_UOM API
    fallbackRates: string[]  // shown when FBR SaleTypeToRate API is unavailable
    fallbackSROs: {
        id: number       // negative = fallback (not a real PRAL ID)
        desc: string     // srO_DESC — goes into sroScheduleNo payload field
        srItems: { id: number; desc: string }[] // srO_ITEM_DESC entries for this SRO
    }[]
}

// Common SR# items reused across multiple SROs

const TableI = [{ "id": 17215, "desc": "100" }, { "id": 17264, "desc": "100A" }, { "id": 17265, "desc": "100A((i))" }, { "id": 17266, "desc": "100A((ii))" }, { "id": 17267, "desc": "100A((iii))" }, { "id": 17268, "desc": "100B" }, { "id": 17269, "desc": "100B" }, { "id": 17270, "desc": "100B((i))" }, { "id": 17271, "desc": "100B((ii))" }, { "id": 17272, "desc": "100B((iii))" }, { "id": 17273, "desc": "100B((iv))" }, { "id": 17274, "desc": "100B((v))" }, { "id": 17275, "desc": "100B((vi))" }, { "id": 17276, "desc": "100C" }, { "id": 17216, "desc": "101" }, { "id": 17218, "desc": "103" }, { "id": 17277, "desc": "104(a)" }, { "id": 17278, "desc": "104(b)" }, { "id": 17279, "desc": "104(c)" }, { "id": 17280, "desc": "104(d)" }, { "id": 17281, "desc": "104(e)" }, { "id": 17282, "desc": "104(f)" }, { "id": 17283, "desc": "104(g)" }, { "id": 17284, "desc": "104(h)" }, { "id": 17221, "desc": "106" }, { "id": 17222, "desc": "107" }, { "id": 17223, "desc": "108" }, { "id": 17285, "desc": "108(a)" }, { "id": 17286, "desc": "108(b)" }, { "id": 17287, "desc": "108(c)" }, { "id": 17288, "desc": "108(d)" }, { "id": 17289, "desc": "108(e)" }, { "id": 17290, "desc": "108(f)" }, { "id": 17291, "desc": "108(g)" }, { "id": 17292, "desc": "108(h)" }, { "id": 17293, "desc": "108(i)" }, { "id": 17294, "desc": "108(j)" }, { "id": 17295, "desc": "108(k)" }, { "id": 17296, "desc": "110(a)" }, { "id": 17297, "desc": "110(b)" }, { "id": 17298, "desc": "110(c)" }, { "id": 17299, "desc": "110(d)" }, { "id": 17300, "desc": "110(e)" }, { "id": 17301, "desc": "110(f)" }, { "id": 17302, "desc": "110(g)" }, { "id": 17303, "desc": "110(h)" }, { "id": 17304, "desc": "110(i)" }, { "id": 17305, "desc": "110(j)" }, { "id": 17226, "desc": "112" }, { "id": 17306, "desc": "112A" }, { "id": 17307, "desc": "112A(i)" }, { "id": 17308, "desc": "112A(ii)" }, { "id": 17309, "desc": "112A(iii)" }, { "id": 17310, "desc": "112A(iv)" }, { "id": 17311, "desc": "112A(ix)" }, { "id": 17312, "desc": "112A(v)" }, { "id": 17313, "desc": "112A(vi)" }, { "id": 17314, "desc": "112A(vii)" }, { "id": 17315, "desc": "112A(viii)" }, { "id": 17316, "desc": "112A(x)" }, { "id": 17317, "desc": "112A(xi)" }, { "id": 17318, "desc": "112A(xii)" }, { "id": 17319, "desc": "112A(xiii)" }, { "id": 17320, "desc": "112A(xiv)" }, { "id": 17321, "desc": "112A(xix)" }, { "id": 17322, "desc": "112A(xv)" }, { "id": 17323, "desc": "112A(xvi)" }, { "id": 17324, "desc": "112A(xvii)" }, { "id": 17325, "desc": "112A(xviii)" }, { "id": 17326, "desc": "112A(xx)" }, { "id": 17327, "desc": "112A(xxi)" }, { "id": 17328, "desc": "112A(xxii)" }, { "id": 17329, "desc": "112A(xxiii)" }, { "id": 17330, "desc": "112A(xxiv)" }, { "id": 17331, "desc": "112A(xxv)" }, { "id": 17332, "desc": "112B" }, { "id": 17333, "desc": "112B(i)" }, { "id": 17334, "desc": "112B(ii)" }, { "id": 17335, "desc": "112B(iii)" }, { "id": 17336, "desc": "112B(iv)" }, { "id": 17337, "desc": "112B(v)" }, { "id": 17338, "desc": "112B(vi)" }, { "id": 17339, "desc": "112B(vii)" }, { "id": 17340, "desc": "112C" }, { "id": 17341, "desc": "112C(i)" }, { "id": 17342, "desc": "112C(ii)" }, { "id": 17343, "desc": "112C(iii)" }, { "id": 17344, "desc": "112C(iv)" }, { "id": 17345, "desc": "112C(ix)" }, { "id": 17346, "desc": "112C(v)" }, { "id": 17347, "desc": "112C(vi)" }, { "id": 17348, "desc": "112C(vii)" }, { "id": 17349, "desc": "112C(viii)" }, { "id": 17350, "desc": "112C(x)" }, { "id": 17351, "desc": "112D" }, { "id": 17352, "desc": "112E" }, { "id": 17353, "desc": "112F" }, { "id": 17354, "desc": "112G" }, { "id": 17355, "desc": "112H" }, { "id": 17356, "desc": "112H(i)" }, { "id": 17357, "desc": "112H(ii)" }, { "id": 17358, "desc": "112H(iii)" }, { "id": 17359, "desc": "112H(iv)" }, { "id": 17360, "desc": "112H(ix)" }, { "id": 17361, "desc": "112H(v)" }, { "id": 17362, "desc": "112H(vi)" }, { "id": 17363, "desc": "112H(vii)" }, { "id": 17364, "desc": "112H(viii)" }, { "id": 17365, "desc": "112H(x)" }, { "id": 17366, "desc": "112H(xi)" }, { "id": 17367, "desc": "112I" }, { "id": 17368, "desc": "112I" }, { "id": 17369, "desc": "112I(i)" }, { "id": 17370, "desc": "112J" }, { "id": 17371, "desc": "112J(i)" }, { "id": 17372, "desc": "112J(ii)" }, { "id": 17373, "desc": "112J(iii)" }, { "id": 17374, "desc": "112J(iv)" }, { "id": 17375, "desc": "112J(ix)" }, { "id": 17376, "desc": "112J(v)" }, { "id": 17377, "desc": "112J(vi)" }, { "id": 17378, "desc": "112J(vii)" }, { "id": 17379, "desc": "112J(viii)" }, { "id": 17380, "desc": "112J(viii)(a)" }, { "id": 17381, "desc": "112J(viii)(b)" }, { "id": 17382, "desc": "112J(viii)(c)" }, { "id": 17383, "desc": "112J(x)" }, { "id": 17384, "desc": "112J(xi)" }, { "id": 17385, "desc": "112J(xii)" }, { "id": 17386, "desc": "112K" }, { "id": 17387, "desc": "112K(i)" }, { "id": 17388, "desc": "112K(ii)" }, { "id": 17389, "desc": "112K(iii)" }, { "id": 17390, "desc": "112K(iv)" }, { "id": 17391, "desc": "112K(ix)" }, { "id": 17392, "desc": "112K(v)" }, { "id": 17393, "desc": "112K(vi)" }, { "id": 17394, "desc": "112K(vii)" }, { "id": 17395, "desc": "112K(viii)" }, { "id": 17396, "desc": "112K(x)" }, { "id": 17397, "desc": "112K(xi)" }, { "id": 17398, "desc": "112K(xii)" }, { "id": 17399, "desc": "112K(xiii)" }, { "id": 17400, "desc": "112K(xiv)" }, { "id": 17401, "desc": "112K(xv)" }, { "id": 17402, "desc": "112K(xvi)" }, { "id": 17403, "desc": "112K(xvii)" }, { "id": 17404, "desc": "112K(xviii)" }, { "id": 17405, "desc": "112L" }, { "id": 17406, "desc": "113(i)" }, { "id": 17407, "desc": "113(ii)" }, { "id": 17408, "desc": "113(iii)" }, { "id": 17409, "desc": "114(i)" }, { "id": 17410, "desc": "114(ii)" }, { "id": 17229, "desc": "115" }, { "id": 17233, "desc": "121" }, { "id": 17234, "desc": "122" }, { "id": 17235, "desc": "123" }, { "id": 17236, "desc": "124" }, { "id": 17237, "desc": "125" }, { "id": 17240, "desc": "128" }, { "id": 17245, "desc": "133" }, { "id": 17249, "desc": "137" }, { "id": 17151, "desc": "14" }, { "id": 17411, "desc": "143(i)" }, { "id": 17412, "desc": "143(i)(a)" }, { "id": 17413, "desc": "143(i)(b)" }, { "id": 17414, "desc": "143(i)(c)" }, { "id": 17415, "desc": "143(i)(d)" }, { "id": 17255, "desc": "144" }, { "id": 17256, "desc": "145" }, { "id": 17416, "desc": "145(i)" }, { "id": 17417, "desc": "145(ii)" }, { "id": 17418, "desc": "145(iii)" }, { "id": 17419, "desc": "145(iv)" }, { "id": 17420, "desc": "145(ix)" }, { "id": 17421, "desc": "145(v)" }, { "id": 17422, "desc": "145(vi)" }, { "id": 17423, "desc": "145(vii)" }, { "id": 17424, "desc": "145(viii)" }, { "id": 17425, "desc": "145(x)" }, { "id": 17426, "desc": "146(a)" }, { "id": 17427, "desc": "146(b)" }, { "id": 17428, "desc": "146(c)" }, { "id": 17429, "desc": "146(d)" }, { "id": 17430, "desc": "146(e)" }, { "id": 17431, "desc": "146(f)" }, { "id": 17432, "desc": "146(g)" }, { "id": 17433, "desc": "146(h)" }, { "id": 17434, "desc": "146(i)" }, { "id": 17435, "desc": "146(j)" }, { "id": 17258, "desc": "147" }, { "id": 17259, "desc": "148" }, { "id": 17436, "desc": "150(a)" }, { "id": 17437, "desc": "150(b)" }, { "id": 17262, "desc": "152" }, { "id": 17263, "desc": "153" }, { "id": 17960, "desc": "156" }, { "id": 17153, "desc": "16" }, { "id": 18127, "desc": "163" }, { "id": 18129, "desc": "165" }, { "id": 18130, "desc": "166" }, { "id": 18131, "desc": "167" }, { "id": 18132, "desc": "168" }, { "id": 17154, "desc": "17" }, { "id": 18135, "desc": "171" }, { "id": 18136, "desc": "172" }, { "id": 18137, "desc": "173" }, { "id": 18205, "desc": "175" }, { "id": 18206, "desc": "176" }, { "id": 18229, "desc": "176(i)" }, { "id": 18230, "desc": "176(ii)" }, { "id": 18231, "desc": "176(iii)" }, { "id": 18232, "desc": "176(iv)" }, { "id": 18207, "desc": "177" }, { "id": 18208, "desc": "178" }, { "id": 18209, "desc": "179" }, { "id": 17155, "desc": "18" }, { "id": 18210, "desc": "180" }, { "id": 18211, "desc": "181" }, { "id": 17156, "desc": "19" }, { "id": 17159, "desc": "22" }, { "id": 17160, "desc": "24" }, { "id": 17161, "desc": "26" }, { "id": 17162, "desc": "27" }, { "id": 17163, "desc": "29" }, { "id": 17440, "desc": "29C" }, { "id": 17164, "desc": "31" }, { "id": 17165, "desc": "32" }, { "id": 17166, "desc": "33" }, { "id": 17167, "desc": "38" }, { "id": 17168, "desc": "45" }, { "id": 17170, "desc": "47" }, { "id": 17171, "desc": "48" }, { "id": 17180, "desc": "56" }, { "id": 17183, "desc": "59" }, { "id": 17189, "desc": "73" }, { "id": 17441, "desc": "73A" }, { "id": 17190, "desc": "74" }, { "id": 17191, "desc": "75" }, { "id": 17192, "desc": "76" }, { "id": 17193, "desc": "77" }, { "id": 17194, "desc": "78" }, { "id": 17195, "desc": "79" }, { "id": 17196, "desc": "80" }, { "id": 17198, "desc": "82" }, { "id": 17199, "desc": "83" }, { "id": 17201, "desc": "85" }, { "id": 17205, "desc": "89" }, { "id": 17207, "desc": "91" }, { "id": 17209, "desc": "93" }, { "id": 17210, "desc": "94" }];
const TableII = [{ "id": 17450, "desc": "10" }, { "id": 17452, "desc": "15(a)" }, { "id": 17453, "desc": "15(b)" }, { "id": 17454, "desc": "15(c.)" }, { "id": 17456, "desc": "17" }, { "id": 17457, "desc": "18" }, { "id": 17458, "desc": "19" }, { "id": 17459, "desc": "20" }, { "id": 17463, "desc": "24" }, { "id": 17464, "desc": "25" }, { "id": 17444, "desc": "3" }, { "id": 17967, "desc": "30" }, { "id": 18060, "desc": "33" }, { "id": 18061, "desc": "34" }, { "id": 18062, "desc": "35" }, { "id": 18063, "desc": "36" }, { "id": 18253, "desc": "37" }, { "id": 18046, "desc": "40" }, { "id": 18047, "desc": "41" }, { "id": 18048, "desc": "42" }, { "id": 18049, "desc": "43" }, { "id": 18050, "desc": "44" }, { "id": 18051, "desc": "45" }, { "id": 18052, "desc": "46" }, { "id": 18053, "desc": "47" }, { "id": 18054, "desc": "48" }, { "id": 18055, "desc": "49" }, { "id": 18056, "desc": "50" }, { "id": 18057, "desc": "51" }, { "id": 18139, "desc": "52" }, { "id": 18140, "desc": "53" }, { "id": 18141, "desc": "54" }, { "id": 18153, "desc": "55" }, { "id": 18233, "desc": "56(i)" }, { "id": 18234, "desc": "56(ii)" }, { "id": 18235, "desc": "57" }, { "id": 17446, "desc": "6" }, { "id": 17448, "desc": "8" }]
const TableIII = [{ "id": 17527, "desc": "11(i)" }, { "id": 17528, "desc": "11(ii)" }, { "id": 17529, "desc": "11(iii)" }, { "id": 17530, "desc": "11(iv)" }, { "id": 17531, "desc": "11(v)" }, { "id": 17532, "desc": "11(vi)" }, { "id": 17533, "desc": "11(vii)" }, { "id": 17534, "desc": "11(viii)" }, { "id": 17535, "desc": "12" }, { "id": 17538, "desc": "14(1)" }, { "id": 17539, "desc": "14(1)(i)" }, { "id": 17540, "desc": "14(1)(ii)" }, { "id": 17541, "desc": "14(1)(iii)" }, { "id": 17542, "desc": "14(1)(iv)" }, { "id": 17543, "desc": "14(1)(v)" }, { "id": 17544, "desc": "14(1)(vi)" }, { "id": 17545, "desc": "14(2)" }, { "id": 17614, "desc": "14A(10)" }, { "id": 17615, "desc": "14A(11)" }, { "id": 17616, "desc": "14A(12)" }, { "id": 17617, "desc": "14A(12a)" }, { "id": 17618, "desc": "14A(12b)" }, { "id": 17619, "desc": "14A(12b)(i)" }, { "id": 17620, "desc": "14A(12b)(ii)" }, { "id": 17621, "desc": "14A(12b)(iii)" }, { "id": 17622, "desc": "14A(12b)(iv)" }, { "id": 17623, "desc": "14A(12b)(v)" }, { "id": 17624, "desc": "14A(12b)(vi)" }, { "id": 17625, "desc": "14A(13)" }, { "id": 17626, "desc": "14A(14)" }, { "id": 17627, "desc": "14A(14)(i)" }, { "id": 17628, "desc": "14A(14)(ii)" }, { "id": 17629, "desc": "14A(14)(iii)" }, { "id": 17630, "desc": "14A(14)(iv)" }, { "id": 17635, "desc": "14A(14)(ix)" }, { "id": 17631, "desc": "14A(14)(v)" }, { "id": 17632, "desc": "14A(14)(vi)" }, { "id": 17633, "desc": "14A(14)(vii)" }, { "id": 17634, "desc": "14A(14)(viii)" }, { "id": 17636, "desc": "14A(14)(x)" }, { "id": 17547, "desc": "14A(1a)" }, { "id": 17548, "desc": "14A(1b)" }, { "id": 17549, "desc": "14A(1b)(i)" }, { "id": 17550, "desc": "14A(1b)(ii)" }, { "id": 17551, "desc": "14A(1b)(iii)" }, { "id": 17552, "desc": "14A(1b)(iv)" }, { "id": 17553, "desc": "14A(1b)(v)" }, { "id": 17554, "desc": "14A(1b)(vi)" }, { "id": 17555, "desc": "14A(2a)" }, { "id": 17556, "desc": "14A(2b)" }, { "id": 17557, "desc": "14A(2b)(i)" }, { "id": 17558, "desc": "14A(2b)(ii)" }, { "id": 17559, "desc": "14A(2b)(iii)" }, { "id": 17560, "desc": "14A(2b)(iv)" }, { "id": 17561, "desc": "14A(2b)(v)" }, { "id": 17562, "desc": "14A(3a)" }, { "id": 17563, "desc": "14A(3b)" }, { "id": 17564, "desc": "14A(3b)(i)" }, { "id": 17565, "desc": "14A(3b)(ii)" }, { "id": 17566, "desc": "14A(3b)(iii)" }, { "id": 17567, "desc": "14A(3b)(iv)" }, { "id": 17568, "desc": "14A(3b)(v)" }, { "id": 17569, "desc": "14A(3b)(vi)" }, { "id": 17570, "desc": "14A(4a)" }, { "id": 17571, "desc": "14A(4b)" }, { "id": 17572, "desc": "14A(4b)(i)" }, { "id": 17573, "desc": "14A(4b)(ii)" }, { "id": 17574, "desc": "14A(4b)(iii)" }, { "id": 17575, "desc": "14A(4b)(iv)" }, { "id": 17576, "desc": "14A(4b)(v)" }, { "id": 17577, "desc": "14A(5)" }, { "id": 17578, "desc": "14A(6a)" }, { "id": 17579, "desc": "14A(6b)" }, { "id": 17580, "desc": "14A(6b)(i)" }, { "id": 17581, "desc": "14A(6b)(ii)" }, { "id": 17582, "desc": "14A(6b)(iii)" }, { "id": 17583, "desc": "14A(6b)(iv)" }, { "id": 17584, "desc": "14A(6c)" }, { "id": 17585, "desc": "14A(6c)(i)" }, { "id": 17586, "desc": "14A(6c)(ii)" }, { "id": 17587, "desc": "14A(6c)(iii)" }, { "id": 17588, "desc": "14A(6c)(iv)" }, { "id": 17589, "desc": "14A(6c)(v)" }, { "id": 17590, "desc": "14A(6c)(vi)" }, { "id": 17591, "desc": "14A(7a)" }, { "id": 17592, "desc": "14A(7b)" }, { "id": 17593, "desc": "14A(7b)(i)" }, { "id": 17594, "desc": "14A(7b)(ii)" }, { "id": 17595, "desc": "14A(7b)(iii)" }, { "id": 17596, "desc": "14A(7b)(iv)" }, { "id": 17601, "desc": "14A(7b)(ix)" }, { "id": 17597, "desc": "14A(7b)(v)" }, { "id": 17598, "desc": "14A(7b)(vi)" }, { "id": 17599, "desc": "14A(7b)(vii)" }, { "id": 17600, "desc": "14A(7b)(viii)" }, { "id": 17602, "desc": "14A(7b)(x)" }, { "id": 17603, "desc": "14A(7b)(xi)" }, { "id": 17604, "desc": "14A(8)" }, { "id": 17605, "desc": "14A(8)(i)" }, { "id": 17606, "desc": "14A(8)(ii)" }, { "id": 17607, "desc": "14A(8)(iii)" }, { "id": 17608, "desc": "14A(8)(iv)" }, { "id": 17609, "desc": "14A(8)(v)" }, { "id": 17610, "desc": "14A(8)(vi)" }, { "id": 17611, "desc": "14A(8)(vii)" }, { "id": 17612, "desc": "14A(8)(viii)" }, { "id": 17613, "desc": "14A(9)" }, { "id": 17637, "desc": "15(i)" }, { "id": 17638, "desc": "15(ii)" }, { "id": 17639, "desc": "15(iii)" }, { "id": 17640, "desc": "15(iv)" }, { "id": 17645, "desc": "15(ix)" }, { "id": 17641, "desc": "15(v)" }, { "id": 17642, "desc": "15(vi)" }, { "id": 17643, "desc": "15(vii)" }, { "id": 17644, "desc": "15(viii)" }, { "id": 17646, "desc": "15(x)" }, { "id": 17647, "desc": "15(xi)" }, { "id": 17648, "desc": "15(xii)" }, { "id": 17649, "desc": "15(xiii)" }, { "id": 17650, "desc": "15(xiv)" }, { "id": 17651, "desc": "15(xv)" }, { "id": 17652, "desc": "15(xvi)" }, { "id": 17653, "desc": "15A(i)" }, { "id": 17654, "desc": "15A(ii)" }, { "id": 17655, "desc": "15A(iii)" }, { "id": 17656, "desc": "15A(iv)" }, { "id": 17657, "desc": "16" }, { "id": 17659, "desc": "18(i)" }, { "id": 17660, "desc": "18(ii)" }, { "id": 17661, "desc": "18(iii)" }, { "id": 17662, "desc": "18(iv)" }, { "id": 17667, "desc": "18(ix)" }, { "id": 17663, "desc": "18(v)" }, { "id": 17664, "desc": "18(vi)" }, { "id": 17665, "desc": "18(vii)" }, { "id": 17666, "desc": "18(viii)" }, { "id": 17668, "desc": "18(x)" }, { "id": 17669, "desc": "18(xi)" }, { "id": 17670, "desc": "18(xii)" }, { "id": 17671, "desc": "18(xiii)" }, { "id": 17672, "desc": "18(xiv)" }, { "id": 17677, "desc": "18(xix)" }, { "id": 17673, "desc": "18(xv)" }, { "id": 17674, "desc": "18(xvi)" }, { "id": 17675, "desc": "18(xvii)" }, { "id": 17676, "desc": "18(xviii)" }, { "id": 17678, "desc": "18(xx)" }, { "id": 17679, "desc": "18(xxi)" }, { "id": 17680, "desc": "19" }, { "id": 18142, "desc": "22" }, { "id": 17468, "desc": "2A(i)" }, { "id": 17469, "desc": "2A(ii)" }, { "id": 17470, "desc": "2A(iii)" }, { "id": 17471, "desc": "2A(iv)" }, { "id": 17476, "desc": "2A(ix)" }, { "id": 17472, "desc": "2A(v)" }, { "id": 17473, "desc": "2A(vi)" }, { "id": 17474, "desc": "2A(vii)" }, { "id": 17475, "desc": "2A(viii)" }, { "id": 17477, "desc": "2B" }, { "id": 17478, "desc": "2B(i)" }, { "id": 17479, "desc": "2B(ii)" }, { "id": 17480, "desc": "2B(iii)" }, { "id": 17481, "desc": "2C" }, { "id": 17482, "desc": "2C(i)" }, { "id": 17483, "desc": "2C(ii)" }, { "id": 17484, "desc": "2D" }, { "id": 17485, "desc": "2D(i)" }, { "id": 17486, "desc": "2D(ii)" }, { "id": 17487, "desc": "3(i)" }, { "id": 17488, "desc": "3(ii)" }, { "id": 17490, "desc": "5(i)" }, { "id": 17491, "desc": "5(ii)" }, { "id": 17492, "desc": "6(i)" }, { "id": 17493, "desc": "6(ii)" }, { "id": 17494, "desc": "7(i)" }, { "id": 17495, "desc": "7(ii)" }, { "id": 17496, "desc": "8(i)" }, { "id": 17498, "desc": "8(i)(a)" }, { "id": 17499, "desc": "8(i)(b)" }, { "id": 17500, "desc": "8(i)(c)" }, { "id": 17501, "desc": "8(ii)" }, { "id": 17503, "desc": "9(i)" }, { "id": 17504, "desc": "9(ii)" }, { "id": 17505, "desc": "9(iii)" }, { "id": 17506, "desc": "9(iv)" }, { "id": 17511, "desc": "9(ix)" }, { "id": 17507, "desc": "9(v)" }, { "id": 17508, "desc": "9(vi)" }, { "id": 17509, "desc": "9(vii)" }, { "id": 17510, "desc": "9(viii)" }, { "id": 17512, "desc": "9(x)" }, { "id": 17513, "desc": "9(xi)" }, { "id": 17514, "desc": "9(xii)" }, { "id": 17515, "desc": "9(xiii)" }, { "id": 17516, "desc": "9(xiv)" }, { "id": 17521, "desc": "9(xix)" }, { "id": 17517, "desc": "9(xv)" }, { "id": 17518, "desc": "9(xvi)" }, { "id": 17519, "desc": "9(xvii)" }, { "id": 17520, "desc": "9(xviii)" }, { "id": 17522, "desc": "9(xx)" }, { "id": 17523, "desc": "9(xxi)" }, { "id": 17524, "desc": "9(xxii)" }, { "id": 17525, "desc": "9(xxiii)" }]
const EIGHTH_SCHEDULE = [{ "id": 18154, "desc": "81" }]
const NINTH_SCHEDULE = [{ "id": 18154, "desc": "81" }]
const EXEMPT_SR_ITEMS = [
    { id: -101, desc: '1' }, { id: -102, desc: '2' }, { id: -103, desc: '3' },
    { id: -104, desc: '4' }, { id: -105, desc: '5' }, { id: -106, desc: '6' },
    { id: -107, desc: '7' }, { id: -108, desc: '8' }, { id: -109, desc: '9' },
    { id: -110, desc: '10' }, { id: -111, desc: '12' }, { id: -112, desc: '15' },
    { id: -113, desc: '16' }, { id: -114, desc: '17' }, { id: -115, desc: '18' },
    { id: -116, desc: '20' }, { id: -117, desc: '22' }, { id: -118, desc: '25' },
    { id: -119, desc: '30' }, { id: -120, desc: '35' }, { id: -121, desc: '40' },
    { id: -122, desc: '45' }, { id: -123, desc: '50' }, { id: -124, desc: '55' },
    { id: -125, desc: '60' }, { id: -126, desc: '65' }, { id: -127, desc: '70' },
    { id: -128, desc: '75' }, { id: -129, desc: '80' }, { id: -130, desc: '85' },
    { id: -131, desc: '90' }, { id: -132, desc: '95' }, { id: -133, desc: '100' },
]

const REDUCED_SR_ITEMS = [
    { id: -201, desc: '1' }, { id: -202, desc: '2' }, { id: -203, desc: '3' },
    { id: -204, desc: '4' }, { id: -205, desc: '5' }, { id: -206, desc: '10' },
    { id: -207, desc: '15' }, { id: -208, desc: '20' }, { id: -209, desc: '25' },
    { id: -210, desc: '30' }, { id: -211, desc: '35' }, { id: -212, desc: '40' },
    { id: -213, desc: '50' },
]

export const SALE_TYPE_CONFIG: Record<string, SaleTypeConfig> = {
    SN001: {
        id: 'SN001', scenarioId: 'SN001', label: 'Goods at standard rate (default)',
        transTypeId: 75, requiresSRO: false, requiresSR: false,
        showFT: true, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN002: {
        id: 'SN002', scenarioId: 'SN002', label: 'Goods at standard rate (default)',
        transTypeId: 75, requiresSRO: false, requiresSR: false,
        showFT: true, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN003: {
        id: 'SN003', scenarioId: 'SN003', label: 'Steel melting and re-rolling',
        transTypeId: 123, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'MT', fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN004: {
        id: 'SN004', scenarioId: 'SN004', label: 'Ship breaking',
        transTypeId: 125, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'MT', fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN005: {
        id: 'SN005', scenarioId: 'SN005', label: 'Goods at Reduced Rate',
        transTypeId: 24, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['1%', '2%', '5%', '7%', '10%', '12%', '17%'],
        fallbackSROs: [{ id: -1, desc: 'EIGHTH SCHEDULE Table 1', srItems: [] }],
    },
    SN006: {
        id: 'SN006', scenarioId: 'SN006', label: 'Exempt goods',
        transTypeId: 81, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: true,
        taxBase: 'zero', uomLocked: null, fallbackRates: ['Exempt'],
        fallbackSROs: [
            { id: -1, desc: '6th Schd Table I', srItems: TableI },
            { id: -2, desc: '6th Schd Table II', srItems: TableII },
            { id: -3, desc: '6th Schd Table III', srItems: TableIII },
            { id: -4, desc: 'Eighth Schedule Table 1', srItems: EIGHTH_SCHEDULE },
            { id: -5, desc: 'NINTH SCHEDULE', srItems: NINTH_SCHEDULE },
        ],
    },
    SN007: {
        id: 'SN007', scenarioId: 'SN007', label: 'Goods at zero-rate',
        transTypeId: 21, requiresSRO: true, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'zero', uomLocked: null, fallbackRates: ['0%'],
        fallbackSROs: [
            { id: 106, desc: "327(I) / 2008", srItems: [] },
            { id: 386, desc: "FIFTH SCHEDULE", srItems: [] },
            { id: 396, desc: "SECTION 49", srItems: [] },
            { id: 65, desc: "Section 4(b)", srItems: [] },
        ],
    },
    SN008: {
        id: 'SN008', scenarioId: 'SN008', label: '3rd Schedule Goods',
        transTypeId: 22, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'retailPrice', uomLocked: null, fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN009: {
        id: 'SN009', scenarioId: 'SN009', label: 'Cotton ginners',
        transTypeId: 87, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'KG', fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN010: {
        id: 'SN010', scenarioId: 'SN010', label: 'Telecommunication services',
        transTypeId: 23, requiresSRO: true, requiresSR: false,
        showFT: false, showFED: true, showEXT: true, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['16%', '17%', '18%'],
        fallbackSROs: [{ id: -1, desc: 'SRO 1125(I)/2011 - Telecom Services', srItems: [] }],
    },
    SN011: {
        id: 'SN011', scenarioId: 'SN011', label: 'Toll Manufacturing',
        transTypeId: 24, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'MT', fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN012: {
        id: 'SN012', scenarioId: 'SN012', label: 'Petroleum Products',
        transTypeId: 25, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'KG',
        fallbackRates: ['1.43%', '2%', '5%', '8%', '10%', '12%', '14%', '16%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 940(I)/2007 - Petroleum Products', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN013: {
        id: 'SN013', scenarioId: 'SN013', label: 'Electricity Supply to Retailers',
        transTypeId: 26, requiresSRO: true, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'KWH', fallbackRates: ['5%', '7.5%', '13%', '17%'],
        fallbackSROs: [{ id: -1, desc: 'SRO 1125(I)/2011 - Electricity Retailers', srItems: [] }],
    },
    SN014: {
        id: 'SN014', scenarioId: 'SN014', label: 'Gas to CNG stations',
        transTypeId: 27, requiresSRO: true, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'MMBTU', fallbackRates: ['18%'],
        fallbackSROs: [{ id: -1, desc: 'SRO 1125(I)/2011 - Gas/CNG', srItems: [] }],
    },
    SN015: {
        id: 'SN015', scenarioId: 'SN015', label: 'Mobile Phones',
        transTypeId: 28, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: true, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['17%', '18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 1125(I)/2011 - Mobile Phones', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN016: {
        id: 'SN016', scenarioId: 'SN016', label: 'Processing/ Conversion of Goods',
        transTypeId: 29, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['5%', '8%', '10%', '13%', '18%'], fallbackSROs: [],
    },
    SN017: {
        id: 'SN017', scenarioId: 'SN017', label: 'Goods (FED in ST Mode)',
        transTypeId: 30, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: true, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['8%', '13%', '16%', '17%', '18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 551(I)/2008 - FED in ST Mode (Goods)', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN018: {
        id: 'SN018', scenarioId: 'SN018', label: 'Services (FED in ST Mode)',
        transTypeId: 31, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: true, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['8%', '13%', '16%', '17%', '18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 551(I)/2008 - FED in ST Mode (Services)', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN019: {
        id: 'SN019', scenarioId: 'SN019', label: 'Services',
        transTypeId: 32, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['5%', '8%', '13%', '16%', '18%'], fallbackSROs: [],
    },
    SN020: {
        id: 'SN020', scenarioId: 'SN020', label: 'Electric Vehicle',
        transTypeId: 33, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['1%', '5%', '12.5%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 642(I)/2021 - Electric Vehicles', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN021: {
        id: 'SN021', scenarioId: 'SN021', label: 'Cement /Concrete Block',
        transTypeId: 34, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'MT', fallbackRates: ['rupees 3 per Kg', '18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 940(I)/2007 - Cement/Concrete', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN022: {
        id: 'SN022', scenarioId: 'SN022', label: 'Potassium Chlorate',
        transTypeId: 35, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: true, showEXMT: false,
        taxBase: 'value', uomLocked: 'KG',
        fallbackRates: ['18% along with rupees 60 per kilogram'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 940(I)/2007 - Potassium Chlorate', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN023: {
        id: 'SN023', scenarioId: 'SN023', label: 'CNG Sales',
        transTypeId: 36, requiresSRO: true, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: 'KG', fallbackRates: ['18%'],
        fallbackSROs: [{ id: -1, desc: 'SRO 1125(I)/2011 - CNG Sales', srItems: [] }],
    },
    SN024: {
        id: 'SN024', scenarioId: 'SN024', label: 'Goods as per SRO.297(I)/2023',
        transTypeId: 37, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['5%', '10%', '18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 297(I)/2023 - Specified Goods', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN025: {
        id: 'SN025', scenarioId: 'SN025', label: 'Non-Adjustable Supplies',
        transTypeId: 38, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'retailPrice', uomLocked: null, fallbackRates: ['18%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 1125(I)/2011 - Non-Adjustable', srItems: REDUCED_SR_ITEMS },
        ],
    },
    SN026: {
        id: 'SN026', scenarioId: 'SN026', label: 'Goods at standard rate (default)',
        transTypeId: 18, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null, fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN027: {
        id: 'SN027', scenarioId: 'SN027', label: '3rd Schedule Goods',
        transTypeId: 22, requiresSRO: false, requiresSR: false,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'retailPrice', uomLocked: null, fallbackRates: ['18%'], fallbackSROs: [],
    },
    SN028: {
        id: 'SN028', scenarioId: 'SN028', label: 'Goods at Reduced Rate',
        transTypeId: 19, requiresSRO: true, requiresSR: true,
        showFT: false, showFED: false, showEXT: false, showEXMT: false,
        taxBase: 'value', uomLocked: null,
        fallbackRates: ['1%', '2%', '5%', '7%', '10%', '12%', '17%'],
        fallbackSROs: [
            { id: -1, desc: 'SRO 1125(I)/2011 - Reduced Rate Retailers', srItems: REDUCED_SR_ITEMS },
            { id: -2, desc: 'SRO 678(I)/2004 - Export Oriented', srItems: REDUCED_SR_ITEMS },
        ],
    },
}

/** Ordered list for dropdown display */
export const SALE_TYPE_LIST = Object.values(SALE_TYPE_CONFIG)

/**
 * UOMs that are ALWAYS forced by FBR regardless of HS_UOM API response.
 * Spec §7. Lock the UOM field when one of these is set.
 */
export const FORCED_UOM: Record<string, string> = {
    SN013: 'KWH',
    SN012: 'KG',
    SN023: 'KG',
    SN009: 'KG',
    SN003: 'MT',
    SN004: 'MT',
    SN011: 'MT',
    SN021: 'MT',
    SN014: 'MMBTU',
}

/**
 * Resolve which scenarioId to send in the FBR sandbox payload.
 * SN001 = registered buyer, SN002 = unregistered buyer (same saleType label).
 * Spec §9.
 */
export function getScenarioId(
    saleTypeId: string,
    buyerRegType: 'Registered' | 'Unregistered' | string,
): string {
    if (saleTypeId === 'SN001' || saleTypeId === 'SN002') {
        return buyerRegType === 'Registered' ? 'SN001' : 'SN002'
    }
    return saleTypeId
}

/**
 * Reverse-lookup: given an exact saleType label string (as stored on InvoiceItem.diSaleType),
 * return the first matching SN id. Used by the payload builder to resolve scenarioId.
 * Note: multiple SN ids may share the same label (SN001/SN002, SN008/SN027, etc.).
 */
export function getSaleTypeIdFromLabel(label: string): string | null {
    const entry = SALE_TYPE_LIST.find(
        (c) => c.label.toLowerCase() === label?.toLowerCase(),
    )
    return entry?.id ?? null
}
