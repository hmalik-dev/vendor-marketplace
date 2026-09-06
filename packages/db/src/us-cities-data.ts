/**
 * Every US place the `City` typeahead may suggest, one per line as
 * `name<TAB>state<TAB>population`.
 *
 * **Generated — do not edit by hand.** Rebuild with
 * `pnpm --filter @vendor-marketplace/db cities:build`, whose header explains
 * both sources and why it takes two of them. Committed rather than fetched
 * because the places of the United States change about once a decade and a
 * seed that needs the network is a seed that fails in CI.
 *
 * A tab-separated blob rather than 35,618 object
 * literals: it parses as one string, which is roughly a tenth of the work, and
 * it diffs a line per place when the decade turns.
 *
 * Sources:
 * - US Census Bureau, 2024 Gazetteer Places file — public domain.
 * - GeoNames (https://www.geonames.org), used under CC BY 4.0
 *   (https://creativecommons.org/licenses/by/4.0/), for population.
 *
 * `population` is a **ranking key only**. It never leaves the API — see
 * `placeSuggestionSchema` — because #384's instruction was that the field must
 * not indicate how many of anything is in a city.
 */
export const US_CITY_TSV = `Adak	AK	332
Akhiok	AK	72
Akiachak	AK	627
Akiak	AK	365
Akutan	AK	1040
Alakanuk	AK	735
Alatna	AK	37
Alcan Border	AK	33
Aleknagik	AK	226
Aleneva	AK	37
Allakaket	AK	104
Ambler	AK	267
Anaktuvuk Pass	AK	337
Anchor Point	AK	1930
Anchorage	AK	289600
Anderson	AK	265
Angoon	AK	456
Aniak	AK	528
Anvik	AK	84
Arctic	AK	0
Arctic Village	AK	152
Atka	AK	64
Atmautluak	AK	277
Atqasuk	AK	240
Attu Station	AK	21
Badger	AK	19482
Bear Creek	AK	1956
Beaver	AK	84
Beluga	AK	20
Bethel	AK	6450
Bettles	AK	12
Big Delta	AK	591
Big Lake	AK	3350
Birch Creek	AK	33
Brevig Mission	AK	400
Buckland	AK	431
Buffalo Soapstone	AK	855
Butte	AK	3246
Cantwell	AK	219
Central	AK	96
Chalkyitsik	AK	69
Chase	AK	34
Chefornak	AK	441
Chena Ridge	AK	0
Chenega	AK	76
Chevak	AK	1018
Chickaloon	AK	272
Chicken	AK	7
Chignik	AK	87
Chignik Lagoon	AK	78
Chignik Lake	AK	73
Chiniak	AK	47
Chisana	AK	0
Chistochina	AK	93
Chitina	AK	126
Chuathbaluk	AK	125
Circle	AK	104
Clam Gulch	AK	176
Clark's Point	AK	0
Clarks Point	AK	62
Clear	AK	24
Coffman Cove	AK	180
Cohoe	AK	1364
Cold Bay	AK	123
Coldfoot	AK	10
College	AK	12964
Cooper Landing	AK	289
Copper Center	AK	328
Copperville	AK	186
Cordova	AK	2196
Covenant Life	AK	86
Craig	AK	1248
Crooked Creek	AK	105
Crown Point	AK	74
Cube Cove	AK	73
Deering	AK	127
Delta Junction	AK	929
Deltana	AK	2251
Denali National Park	AK	217
Denali Park	AK	185
Diamond Ridge	AK	1156
Dillingham	AK	2404
Diomede	AK	118
Dot Lake	AK	13
Dot Lake Village	AK	62
Dry Creek	AK	94
Dutch Harbor	AK	4376
Eagle	AK	86
Eagle River	AK	24793
Eagle Village	AK	67
Eareckson Station	AK	0
Edna Bay	AK	44
Eek	AK	312
Egegik	AK	106
Eielson AFB	AK	0
Eielson Air Force Base	AK	2647
Ekwok	AK	118
Elfin Cove	AK	20
Elim	AK	340
Elmendorf Air Force Base	AK	6621
Emmonak	AK	849
Ester	AK	2422
Eureka Roadhouse	AK	29
Evansville	AK	15
Excursion Inlet	AK	11
Fairbanks	AK	32325
False Pass	AK	40
Farm Loop	AK	1028
Farmers Loop	AK	4853
Ferry	AK	33
Fishhook	AK	4679
Flat	AK	0
Fort Greely	AK	539
Fort Yukon	AK	570
Four Mile Road	AK	43
Fox	AK	417
Fox River	AK	685
Fritz Creek	AK	1932
Funny River	AK	1103
Gakona	AK	218
Galena	AK	467
Gambell	AK	701
Game Creek	AK	18
Gateway	AK	5552
Girdwood	AK	2250
Glacier View	AK	234
Glennallen	AK	483
Goldstream	AK	0
Golovin	AK	161
Goodnews Bay	AK	256
Grayling	AK	193
Gulkana	AK	119
Gustavus	AK	434
Haines	AK	1713
Halibut Cove	AK	76
Happy Valley	AK	593
Harding-Birch Lakes	AK	299
Healy	AK	1021
Healy Lake	AK	13
Hobart Bay	AK	1
Hollis	AK	112
Holy Cross	AK	177
Homer	AK	5515
Hoonah	AK	757
Hooper Bay	AK	1187
Hope	AK	192
Houston	AK	2206
Hughes	AK	77
Huslia	AK	275
Hydaburg	AK	391
Hyder	AK	20
Igiugig	AK	50
Iliamna	AK	109
Ivanof Bay	AK	7
Juneau	AK	31555
Kachemak	AK	487
Kachemak City	AK	472
Kake	AK	570
Kaktovik	AK	239
Kalifornsky	AK	7850
Kalskag	AK	210
Kaltag	AK	189
Karluk	AK	37
Kasaan	AK	51
Kasigluk	AK	569
Kasilof	AK	549
Kenai	AK	7661
Kenny Lake	AK	355
Ketchikan	AK	8197
Kiana	AK	361
King Cove	AK	1009
King Salmon	AK	374
Kipnuk	AK	639
Kivalina	AK	388
Klawock	AK	765
Klukwan	AK	95
Knik	AK	272
Knik River	AK	744
Knik-Fairview	AK	14923
Kobuk	AK	158
Kodiak	AK	6253
Kodiak Station	AK	1301
Kokhanok	AK	170
Koliganek	AK	209
Kongiganak	AK	439
Kotlik	AK	626
Kotzebue	AK	3277
Koyuk	AK	342
Koyukuk	AK	96
Kupreanof	AK	27
Kwethluk	AK	760
Kwigillingok	AK	321
Lake Louise	AK	46
Lake Minchumina	AK	13
Lakes	AK	8364
Larsen Bay	AK	88
Lazy Mountain	AK	1479
Levelock	AK	69
Lime	AK	0
Lime Village	AK	29
Livengood	AK	13
Loring	AK	4
Lowell Point	AK	80
Lower Kalskag	AK	297
Lutak	AK	49
Manley Hot Springs	AK	89
Manokotak	AK	456
Marshall	AK	449
McCarthy	AK	28
McGrath	AK	344
Meadow Lakes	AK	7570
Mekoryuk	AK	202
Mendeltna	AK	39
Mentasta Lake	AK	112
Mertarvik	AK	0
Metlakatla	AK	1405
Meyers Chuck	AK	19
Mill Bay	AK	0
Minto	AK	210
Moose Creek	AK	747
Moose Pass	AK	219
Mosquito Lake	AK	309
Mountain	AK	0
Mountain Village	AK	883
Mud Bay	AK	212
Nabesna	AK	5
Naknek	AK	544
Nanwalek	AK	254
Napakiak	AK	373
Napaskiak	AK	427
Naukati Bay	AK	113
Nelchina	AK	59
Nelson Lagoon	AK	52
Nenana	AK	376
New Allakaket	AK	66
New Stuyahok	AK	526
Newhalen	AK	182
Newtok	AK	354
Nightmute	AK	295
Nikiski	AK	4493
Nikolaevsk	AK	318
Nikolai	AK	93
Nikolski	AK	18
Ninilchik	AK	883
Noatak	AK	514
Nome	AK	3806
Nondalton	AK	157
Noorvik	AK	694
North Lakes	AK	0
North Pole	AK	2189
Northway	AK	71
Northway Junction	AK	54
Northway Village	AK	98
Nuiqsut	AK	416
Nulato	AK	262
Nunam Iqua	AK	203
Nunapitchuk	AK	523
Old Harbor	AK	221
Oscarville	AK	70
Ouzinkie	AK	163
Palmer	AK	6788
Paxson	AK	40
Pedro Bay	AK	42
Pelican	AK	91
Perryville	AK	113
Petersburg	AK	2948
Petersville	AK	4
Pilot Point	AK	65
Pilot Station	AK	617
Pitkas Point	AK	109
Platinum	AK	64
Pleasant Valley	AK	725
Point Baker	AK	15
Point Hope	AK	701
Point Lay	AK	189
Point MacKenzie	AK	529
Point Possession	AK	3
Pope-Vannoy Landing	AK	6
Port Alexander	AK	54
Port Alsworth	AK	159
Port Clarence	AK	24
Port Graham	AK	177
Port Heiden	AK	0
Port Lions	AK	197
Port Protection	AK	48
Portage Creek	AK	2
Primrose	AK	78
Prudhoe Bay	AK	2174
Quinhagak	AK	706
Rampart	AK	24
Red Devil	AK	23
Red Dog Mine	AK	309
Ridgeway	AK	2022
Ruby	AK	165
Russian Mission	AK	339
Saint George	AK	102
Salamatof	AK	980
Salcha	AK	1095
Sand Point	AK	1064
Savoonga	AK	691
Saxman	AK	417
Scammon Bay	AK	515
Selawik	AK	859
Seldovia	AK	277
Seldovia Village	AK	165
Seward	AK	2790
Shageluk	AK	83
Shaktoolik	AK	258
Shishmaref	AK	580
Shungnak	AK	273
Silver Springs	AK	114
Sitka	AK	8863
Skagway	AK	1240
Skwentna	AK	37
Slana	AK	147
Sleetmute	AK	86
Soldotna	AK	4544
Solomon	AK	12
South Lakes	AK	0
South Naknek	AK	79
South Van Horn	AK	558
St. George	AK	0
St. Mary's	AK	550
St. Michael	AK	401
St. Paul	AK	479
Stebbins	AK	572
Steele Creek	AK	0
Sterling	AK	5617
Stevens	AK	0
Stevens Village	AK	78
Stony River	AK	54
Sunrise	AK	19
Susitna	AK	18
Susitna North	AK	1260
Sutton-Alpine	AK	1447
Takotna	AK	52
Talkeetna	AK	876
Tanacross	AK	136
Tanaina	AK	8197
Tanana	AK	244
Tatitlek	AK	88
Tazlina	AK	297
Teller	AK	236
Tenakee Springs	AK	133
Tetlin	AK	127
Thoms Place	AK	23
Thorne Bay	AK	483
Togiak	AK	842
Tok	AK	1258
Toksook Bay	AK	622
Tolsona	AK	30
Tonsina	AK	78
Trapper Creek	AK	481
Tuluksak	AK	373
Tuntutuliak	AK	408
Tununak	AK	327
Twin Hills	AK	74
Two Rivers	AK	719
Tyonek	AK	171
Ugashik	AK	12
Unalakleet	AK	708
Unalaska	AK	4491
Upper Kalskag	AK	0
UtqiagÌvik	AK	0
Utqiagvik	AK	4384
Valdez	AK	3870
Venetie	AK	166
Wainwright	AK	580
Wales	AK	149
Wasilla	AK	9284
Whale Pass	AK	31
White Mountain	AK	196
Whitestone	AK	97
Whitestone Logging Camp	AK	17
Whittier	AK	214
Willow	AK	2102
Willow Creek	AK	212
Wiseman	AK	14
Womens Bay	AK	719
Wrangell	AK	2382
Yakutat	AK	662
Abanda	AL	192
Abbeville	AL	2620
Adamsville	AL	4400
Addison	AL	741
Akron	AL	337
Alabaster	AL	32707
Albertville	AL	21462
Alexander	AL	0
Alexander City	AL	14718
Alexandria	AL	3917
Aliceville	AL	2381
Allgood	AL	628
Altoona	AL	924
Andalusia	AL	9063
Anderson	AL	341
Anniston	AL	22347
Arab	AL	8295
Ardmore	AL	0
Argo	AL	4071
Ariton	AL	746
Arley	AL	352
Ashford	AL	2158
Ashland	AL	1983
Ashville	AL	2256
Athens	AL	24966
Atmore	AL	10049
Attalla	AL	5899
Auburn	AL	62059
Autaugaville	AL	859
Avon	AL	530
Axis	AL	757
Babbie	AL	606
Baileyton	AL	625
Baker Hill	AL	279
Bakerhill	AL	0
Ballplay	AL	1580
Banks	AL	174
Bay Minette	AL	9118
Bayou La Batre	AL	2621
Bear Creek	AL	1047
Beatrice	AL	285
Beaverton	AL	187
Belgreen	AL	129
Belk	AL	210
Bellamy	AL	543
Belle Fontaine	AL	0
Bellefontaine	AL	608
Benton	AL	46
Berlin	AL	0
Berry	AL	1113
Bessemer	AL	26730
Billingsley	AL	141
Birmingham	AL	196357
Black	AL	208
Blountsville	AL	1697
Blue Mountain	AL	233
Blue Ridge	AL	1341
Blue Springs	AL	92
Boaz	AL	9688
Boligee	AL	309
Bon Air	AL	114
Bon Secour	AL	0
Boykin	AL	275
Branchville	AL	973
Brantley	AL	805
Brantleyville	AL	884
Brent	AL	4898
Brewton	AL	5434
Bridgeport	AL	2355
Brighton	AL	2862
Brilliant	AL	884
Bristow Cove	AL	0
Brook Highland	AL	6746
Brookside	AL	1329
Brookwood	AL	1822
Broomtown	AL	182
Brundidge	AL	1989
Bucks	AL	32
Butler	AL	1798
Bynum	AL	1795
Cahaba Heights	AL	5287
Calera	AL	13213
Calvert	AL	277
Camden	AL	1930
Camp Hill	AL	981
Carbon Hill	AL	1975
Cardiff	AL	54
Carlisle-Rockledge	AL	2137
Carlton	AL	65
Carolina	AL	299
Carrollton	AL	988
Castleberry	AL	565
Catherine	AL	22
Cedar Bluff	AL	1802
Center Point	AL	16655
Centre	AL	3570
Centreville	AL	2704
Chalkville	AL	3901
Chatom	AL	1237
Chelsea	AL	12059
Cherokee	AL	1014
Cherokee Ridge	AL	0
Chickasaw	AL	5954
Childersburg	AL	5046
Choccolocco	AL	2804
Chunchula	AL	210
Citronelle	AL	3887
Clanton	AL	8844
Clay	AL	9655
Clayhatchee	AL	577
Clayton	AL	2925
Cleveland	AL	1315
Clio	AL	1529
Coaling	AL	1648
Coats Bend	AL	0
Coffee Springs	AL	229
Coffeeville	AL	338
Coker	AL	978
Collinsville	AL	1973
Colony	AL	394
Columbia	AL	737
Columbiana	AL	4168
Concord	AL	1837
Coosada	AL	1240
Cordova	AL	2028
Cottondale	AL	0
Cottonwood	AL	1264
County Line	AL	261
Courtland	AL	597
Cowarts	AL	1988
Creola	AL	1955
Crossville	AL	1848
Cuba	AL	321
Cullman	AL	15350
Cullomburg	AL	171
Cusseta	AL	124
Dadeville	AL	3150
Daleville	AL	5141
Danville	AL	6242
Daphne	AL	24896
Dauphin Island	AL	1251
Daviston	AL	210
Dayton	AL	50
Deatsville	AL	1157
Decatur	AL	55437
Deer Park	AL	188
Delta	AL	197
Demopolis	AL	7148
Detroit	AL	227
Dixiana	AL	22940
Dixonville	AL	181
Dodge	AL	0
Dodge City	AL	603
Dora	AL	1960
Dothan	AL	68567
Double Springs	AL	1056
Douglas	AL	758
Dozier	AL	332
Dunnavant	AL	981
Dutton	AL	310
Eagle Point	AL	0
East Brewton	AL	2419
East Florence	AL	35733
East Point	AL	201
Eclectic	AL	1029
Edgewater	AL	883
Edwardsville	AL	204
Egypt	AL	932
Elba	AL	3903
Elberta	AL	1652
Eldridge	AL	128
Elkmont	AL	466
Elmore	AL	1271
Emelle	AL	50
Emerald Mountain	AL	2561
Enterprise	AL	27978
Epes	AL	183
Equality	AL	0
Ethelsville	AL	73
Eufaula	AL	12596
Eunola	AL	243
Eutaw	AL	2766
Eva	AL	511
Evergreen	AL	3774
Excel	AL	672
Fairfield	AL	10907
Fairford	AL	186
Fairhope	AL	18730
Fairview	AL	456
Falkville	AL	1268
Faunsdale	AL	94
Fayette	AL	4490
Fayetteville	AL	1284
Fitzpatrick	AL	83
Five Points	AL	142
Flint City	AL	1033
Flomaton	AL	1411
Florala	AL	1973
Florence	AL	40026
Foley	AL	17218
Forestdale	AL	10162
Forkland	AL	601
Fort Deposit	AL	1240
Fort Novosel	AL	4636
Fort Payne	AL	14150
Fort Rucker	AL	0
Franklin	AL	132
Fredonia	AL	199
Frisco	AL	0
Frisco City	AL	1223
Fruitdale	AL	185
Fruithurst	AL	282
Fulton	AL	261
Fultondale	AL	9048
Fyffe	AL	1023
Gadsden	AL	36084
Gainesville	AL	197
Gallant	AL	855
Gantt	AL	223
Garden	AL	0
Garden City	AL	496
Gardendale	AL	13711
Gaylesville	AL	144
Geiger	AL	161
Geneva	AL	4460
Georgiana	AL	1667
Geraldine	AL	902
Gilbertown	AL	205
Glen Allen	AL	498
Glencoe	AL	5153
Glenwood	AL	189
Goldville	AL	54
Good Hope	AL	2281
Goodwater	AL	1343
Gordo	AL	1687
Gordon	AL	327
Gordonville	AL	305
Goshen	AL	257
Graham	AL	211
Grand Bay	AL	3672
Grant	AL	903
Grayson Valley	AL	5736
Graysville	AL	2096
Greensboro	AL	2387
Greenville	AL	7845
Grimes	AL	546
Grove Hill	AL	1494
Gu-Win	AL	173
Guin	AL	2322
Gulf Shores	AL	11131
Gulfcrest	AL	161
Guntersville	AL	8385
Gurley	AL	886
Hackleburg	AL	1486
Hackneyville	AL	347
Haleburg	AL	101
Haleyville	AL	4088
Hamilton	AL	6772
Hammondville	AL	487
Hanceville	AL	3281
Hanover	AL	0
Harpersville	AL	1681
Hartford	AL	2647
Hartselle	AL	14493
Harvest	AL	5281
Hatton	AL	261
Hayden	AL	1341
Hayneville	AL	862
Hazel Green	AL	3630
Headland	AL	4736
Heath	AL	257
Heflin	AL	3499
Helena	AL	18264
Henagar	AL	2346
Highland Lake	AL	424
Highland Lakes	AL	3926
Hillsboro	AL	519
Hissop	AL	658
Hobson	AL	126
Hobson City	AL	768
Hodges	AL	285
Hokes Bluff	AL	4301
Hollins	AL	545
Hollis Crossroads	AL	608
Holly Pond	AL	812
Hollywood	AL	974
Holt	AL	3638
Holtville	AL	4096
Homewood	AL	25708
Hoover	AL	84848
Horn Hill	AL	229
Horton	AL	4450
Hueytown	AL	15710
Huguley	AL	2540
Huntsville	AL	215006
Hurtsboro	AL	600
Hytop	AL	349
Ider	AL	716
Indian Springs	AL	0
Indian Springs Village	AL	2523
Inverness	AL	1621
Irondale	AL	12423
Ivalee	AL	879
Jack	AL	1379
Jackson	AL	4967
Jacksons Gap	AL	828
Jacksons' Gap	AL	0
Jacksonville	AL	12222
Jasper	AL	14071
Jemison	AL	2619
Joppa	AL	501
Joquin	AL	501
Kansas	AL	221
Kellyton	AL	200
Kennedy	AL	428
Killen	AL	982
Kimberly	AL	2892
Kinsey	AL	2197
Kinston	AL	540
La Fayette	AL	0
Ladonia	AL	3142
Lafayette	AL	3003
Lake Purdy	AL	7857
Lake View	AL	2114
Lakeview	AL	143
Lanett	AL	6452
Langston	AL	266
Leeds	AL	11936
Leesburg	AL	1014
Leighton	AL	712
Leroy	AL	911
Lester	AL	121
Level Plains	AL	2023
Lexington	AL	723
Libertyville	AL	116
Lillian	AL	1330
Lincoln	AL	6524
Linden	AL	2025
Lineville	AL	2319
Lipscomb	AL	2155
Lisman	AL	505
Littleville	AL	990
Livingston	AL	3414
Loachapoka	AL	190
Lockhart	AL	519
Locust Fork	AL	1192
Lookout Mountain	AL	0
Louisville	AL	487
Lowndesboro	AL	107
Loxley	AL	1785
Luverne	AL	2834
Lynn	AL	641
Macedonia	AL	292
Madison	AL	46962
Madrid	AL	338
Magnolia Springs	AL	791
Malcolm	AL	187
Malvern	AL	1446
Maplesville	AL	704
Marbury	AL	1418
Margaret	AL	4554
Marion	AL	3447
Mathews	AL	593
Maytown	AL	374
McCalla	AL	0
McDonald Chapel	AL	717
McIntosh	AL	226
McKenzie	AL	513
McMullen	AL	10
Meadowbrook	AL	8769
Megargel	AL	62
Memphis	AL	31
Mentone	AL	368
Meridianville	AL	6021
Midfield	AL	5222
Midland	AL	0
Midland City	AL	2386
Midway	AL	488
Mignon	AL	1284
Millbrook	AL	15314
Millerville	AL	278
Millport	AL	998
Millry	AL	524
Minor	AL	1094
Mobile	AL	183289
Monroeville	AL	6110
Montevallo	AL	6648
Montgomery	AL	195287
Moody	AL	12593
Moores Mill	AL	5682
Mooresville	AL	58
Morris	AL	1934
Morrison Crossroads	AL	219
Mosses	AL	955
Moulton	AL	3337
Moundville	AL	2460
Mount Olive	AL	4079
Mount Vernon	AL	1518
Mountain Brook	AL	20691
Mountainboro	AL	333
Movico	AL	305
Mulga	AL	819
Munford	AL	1259
Muscle Shoals	AL	13706
Myrtlewood	AL	124
Nanafalia	AL	94
Nances Creek	AL	407
Napier Field	AL	347
Natural Bridge	AL	36
Nauvoo	AL	213
Nectar	AL	345
Needham	AL	91
New Brockton	AL	1159
New Hope	AL	2800
New Market	AL	1597
New Site	AL	755
New Union	AL	0
Newbern	AL	179
Newton	AL	1472
Newville	AL	520
Nixburg	AL	0
North Bibb	AL	1013
North Courtland	AL	632
North Johns	AL	142
Northport	AL	24772
Notasulga	AL	856
Oak Grove	AL	517
Oak Hill	AL	25
Oakman	AL	760
Odenville	AL	3695
Ohatchee	AL	1146
Oneonta	AL	6615
Onycha	AL	185
Opelika	AL	29527
Opp	AL	6658
Orange Beach	AL	5850
Orrville	AL	190
Our	AL	0
Our Town	AL	641
Owens Cross Roads	AL	1785
Oxford	AL	21249
Ozark	AL	14719
Paint Rock	AL	207
Panola	AL	144
Parrish	AL	963
Pea Ridge	AL	0
Pelham	AL	22885
Pell	AL	0
Pell City	AL	13646
Pennington	AL	210
Penton	AL	201
Perdido	AL	0
Perdido Beach	AL	581
Peterman	AL	89
Petrey	AL	59
Phenix	AL	0
Phenix City	AL	37570
Phil Campbell	AL	1235
Pickensville	AL	581
Piedmont	AL	4714
Pike Road	AL	8274
Pinckard	AL	634
Pine Apple	AL	126
Pine Hill	AL	919
Pine Level	AL	4183
Pine Ridge	AL	283
Pinson	AL	7438
Pisgah	AL	711
Plateau	AL	2000
Pleasant Grove	AL	10260
Pleasant Groves	AL	414
Point Clear	AL	2125
Pollard	AL	135
Powell	AL	957
Prattville	AL	35420
Priceville	AL	3179
Prichard	AL	22351
Providence	AL	214
Putnam	AL	193
Ragland	AL	1682
Rainbow	AL	0
Rainbow City	AL	9580
Rainsville	AL	5031
Ranburne	AL	409
Ray	AL	443
Red Bay	AL	3131
Red Level	AL	490
Redland	AL	0
Redstone Arsenal	AL	1946
Reece	AL	0
Reece City	AL	632
Reeltown	AL	766
Reform	AL	1632
Rehobeth	AL	1449
Remlap	AL	0
Repton	AL	272
Ridgeville	AL	105
River Falls	AL	527
Riverside	AL	2300
Riverview	AL	182
Roanoke	AL	6005
Robertsdale	AL	5894
Rock Creek	AL	1456
Rock Mills	AL	600
Rockford	AL	449
Rockville	AL	43
Rogersville	AL	1231
Rosa	AL	319
Russellville	AL	9847
Rutledge	AL	459
Saint Stephens	AL	495
Saks	AL	10744
Samson	AL	1928
Sand Rock	AL	558
Sanford	AL	247
Saraland	AL	13906
Sardis	AL	0
Sardis City	AL	1755
Satsuma	AL	6182
Scottsboro	AL	14722
Section	AL	759
Selma	AL	19519
Selmont-West Selmont	AL	2671
Semmes	AL	3886
Sheffield	AL	9108
Shelby	AL	1044
Shiloh	AL	275
Shoal Creek	AL	1400
Shorter	AL	429
Silas	AL	432
Silverhill	AL	761
Sims Chapel	AL	153
Sipsey	AL	426
Skyline	AL	839
Slocomb	AL	1972
Smiths Station	AL	5300
Smoke Rise	AL	1825
Snead	AL	843
Somerville	AL	716
South Vinemont	AL	757
Southside	AL	8572
Spanish Fort	AL	8065
Spring Garden	AL	238
Springville	AL	4198
Spruce Pine	AL	222
St. Florian	AL	464
St. Stephens	AL	0
Standing Rock	AL	168
Stapleton	AL	0
Steele	AL	1078
Sterrett	AL	712
Stevenson	AL	1991
Stewartville	AL	1767
Stockton	AL	0
Sulligent	AL	1844
Sumiton	AL	2418
Summerdale	AL	1128
Susan Moore	AL	770
Sweet Water	AL	246
Sylacauga	AL	12657
Sylvan Springs	AL	1524
Sylvania	AL	1854
Talladega	AL	15709
Talladega Springs	AL	163
Tallassee	AL	4778
Tarrant	AL	6210
Taylor	AL	2402
Theodore	AL	6130
Thomaston	AL	398
Thomasville	AL	4051
Thorsby	AL	2044
Tibbie	AL	41
Tidmore Bend	AL	0
Tillmans Corner	AL	17398
Town Creek	AL	1065
Toxey	AL	131
Trafford	AL	634
Triana	AL	525
Trinity	AL	2157
Troy	AL	18853
Trussville	AL	21023
Tuscaloosa	AL	111338
Tuscumbia	AL	8474
Tuskegee	AL	8817
Twin	AL	389
Underwood-Petersville	AL	3247
Union	AL	223
Union Grove	AL	79
Union Springs	AL	3919
Uniontown	AL	2415
Uriah	AL	294
Valley	AL	9464
Valley Grande	AL	3849
Valley Head	AL	550
Vance	AL	1513
Vandiver	AL	1135
Vernon	AL	1895
Vestavia Hills	AL	34174
Vina	AL	357
Vincent	AL	2120
Vinegar Bend	AL	192
Vredenburgh	AL	295
Wadley	AL	738
Waldo	AL	278
Walnut Grove	AL	685
Warrior	AL	3199
Waterloo	AL	200
Waverly	AL	148
Weaver	AL	3091
Webb	AL	1413
Wedowee	AL	809
Weogufka	AL	282
West Blocton	AL	1261
West End-Cobb	AL	0
West End-Cobb Town	AL	3465
West Jefferson	AL	336
West Point	AL	593
Weston	AL	384
Westover	AL	1473
Wetumpka	AL	7994
Whatley	AL	150
White Hall	AL	811
White Plains	AL	811
Whitesboro	AL	2138
Wilmer	AL	597
Wilsonville	AL	1980
Wilton	AL	687
Winfield	AL	4570
Woodland	AL	202
Woodstock	AL	1547
Woodville	AL	735
Yellow Bluff	AL	188
York	AL	2399
Acorn	AR	0
Adona	AR	204
Alexander	AR	2848
Alicia	AR	119
Alix	AR	0
Alleene	AR	0
Allport	AR	114
Alma	AR	5575
Almyra	AR	274
Alpena	AR	394
Alpine	AR	0
Altheimer	AR	894
Altus	AR	730
Amagon	AR	93
Amity	AR	702
Anthonyville	AR	151
Antoine	AR	112
Aplin	AR	0
Appleton	AR	0
Arkadelphia	AR	10745
Arkansas	AR	0
Arkansas City	AR	327
Armorel	AR	0
Ash Flat	AR	1064
Ashdown	AR	4479
Atkins	AR	3051
Aubrey	AR	155
Augusta	AR	2051
Austin	AR	3383
Avilla	AR	896
Avoca	AR	512
Bald Knob	AR	2908
Banks	AR	120
Barling	AR	4740
Bassett	AR	162
Batavia	AR	0
Batesville	AR	10668
Bauxite	AR	495
Bay	AR	1813
Bearden	AR	897
Beaver	AR	101
Bee Branch	AR	0
Beebe	AR	8106
Beedeville	AR	101
Beirne	AR	0
Bella Vista	AR	27999
Bellefonte	AR	478
Belleville	AR	433
Ben Lomond	AR	147
Benton	AR	34177
Bentonville	AR	44499
Bergman	AR	448
Berryville	AR	5371
Bethel Heights	AR	2490
Bethesda	AR	199
Big Flat	AR	103
Bigelow	AR	308
Biggers	AR	337
Birdsong	AR	38
Biscoe	AR	466
Bismarck	AR	0
Black Oak	AR	290
Black Rock	AR	625
Black Springs	AR	96
Blevins	AR	308
Blue Eye	AR	30
Blue Mountain	AR	120
Bluff	AR	0
Bluff City	AR	119
Blytheville	AR	14694
Board Camp	AR	0
Bodcaw	AR	132
Boles	AR	0
Bonanza	AR	556
Bono	AR	2236
Booneville	AR	3888
Bowman	AR	0
Bradford	AR	760
Bradley	AR	566
Branch	AR	358
Briarcliff	AR	235
Brinkley	AR	2890
Brookland	AR	2977
Bryant	AR	19986
Buckner	AR	252
Buffalo	AR	0
Bull Shoals	AR	1933
Burdette	AR	132
Cabot	AR	25587
Caddo Gap	AR	0
Caddo Valley	AR	607
Caldwell	AR	498
Cale	AR	76
Calico Rock	AR	1734
Calion	AR	466
Camden	AR	11347
Cammack	AR	0
Cammack Village	AR	748
Campbell Station	AR	241
Canehill	AR	0
Caraway	AR	1270
Carlisle	AR	2183
Carthage	AR	322
Casa	AR	167
Cash	AR	362
Caulksville	AR	206
Cave	AR	0
Cave City	AR	1868
Cave Springs	AR	3076
Cedarville	AR	1368
Center Point	AR	0
Center Ridge	AR	388
Centerton	AR	12023
Centerville	AR	0
Central	AR	0
Central City	AR	494
Charleston	AR	2483
Cherokee	AR	0
Cherokee City	AR	72
Cherokee Village	AR	4603
Cherry Valley	AR	615
Chester	AR	160
Chidester	AR	271
Cincinnati	AR	306
Clarendon	AR	1504
Clarkedale	AR	353
Clarksville	AR	9433
Clinton	AR	2538
Coal Hill	AR	1025
College City	AR	537
College Station	AR	600
Collins	AR	0
Colt	AR	351
Concord	AR	238
Conway	AR	64980
Corinth	AR	69
Corning	AR	3162
Cotter	AR	951
Cotton Plant	AR	604
Cove	AR	373
Coy	AR	95
Crawfordsville	AR	456
Crossett	AR	5220
Crystal Springs	AR	0
Cushman	AR	453
Daisy	AR	110
Damascus	AR	383
Danville	AR	2350
Dardanelle	AR	4659
Datto	AR	94
De Queen	AR	6707
De Valls Bluff	AR	587
De Witt	AR	3292
Decatur	AR	1773
Deer	AR	0
Delaplaine	AR	117
Delight	AR	268
Dell	AR	209
Dennard	AR	530
Denning	AR	307
Dermott	AR	2720
Des Arc	AR	1639
Desha	AR	0
DeWitt	AR	0
Diamond	AR	0
Diamond City	AR	781
Diaz	AR	1248
Dierks	AR	1092
Donaldson	AR	300
Dora	AR	0
Dover	AR	1398
Drasco	AR	0
Dumas	AR	4323
Dyer	AR	860
Dyess	AR	384
Earle	AR	2282
East Camden	AR	862
East End	AR	6998
Edgemont	AR	0
Edmondson	AR	404
Egypt	AR	112
El Dorado	AR	18386
El Paso	AR	267
Elaine	AR	556
Elkins	AR	2946
Elm Springs	AR	2147
Emerson	AR	354
Emmet	AR	486
England	AR	2765
Enola	AR	344
Etowah	AR	240
Eudora	AR	2102
Eureka Springs	AR	2083
Evansville	AR	0
Evening Shade	AR	421
Everton	AR	134
Fair Oaks	AR	0
Fairfield Bay	AR	2268
Fargo	AR	90
Farmington	AR	6701
Fayetteville	AR	82830
Felsenthal	AR	143
Fifty-Six	AR	173
Fisher	AR	218
Flippin	AR	1335
Floral	AR	0
Floyd	AR	0
Fordyce	AR	4027
Foreman	AR	951
Forrest	AR	0
Forrest City	AR	14672
Fort Smith	AR	88194
Fouke	AR	873
Fountain Hill	AR	168
Fountain Lake	AR	503
Fourche	AR	61
Fox	AR	0
Franklin	AR	191
Fredonia (Biscoe)	AR	0
Friendship	AR	176
Fulton	AR	196
Gamaliel	AR	0
Garfield	AR	527
Garland	AR	243
Garner	AR	284
Gassville	AR	2133
Gateway	AR	425
Genoa	AR	0
Gentry	AR	3397
Georgetown	AR	124
Gibson	AR	3543
Gilbert	AR	27
Gillett	AR	688
Gillham	AR	162
Gilmore	AR	252
Glenwood	AR	2141
Goodwin	AR	0
Goshen	AR	1589
Gosnell	AR	2689
Gould	AR	778
Grady	AR	412
Grannis	AR	562
Gravel Ridge	AR	2902
Gravette	AR	3232
Green Forest	AR	2769
Greenbrier	AR	5296
Greenland	AR	1388
Greenway	AR	196
Greenwood	AR	9322
Greers Ferry	AR	871
Gregory	AR	0
Griffithville	AR	225
Grubbs	AR	366
Guion	AR	83
Gum Springs	AR	117
Gurdon	AR	2144
Guy	AR	718
Hackett	AR	818
Hagarville	AR	129
Halley	AR	0
Hamburg	AR	2791
Hampton	AR	1281
Hardy	AR	759
Harrell	AR	248
Harrisburg	AR	2302
Harrison	AR	13138
Hartford	AR	643
Hartman	AR	530
Haskell	AR	4480
Hatfield	AR	403
Hattieville	AR	0
Havana	AR	368
Haynes	AR	136
Hazen	AR	1404
Heber Springs	AR	7156
Hector	AR	452
Helena	AR	5548
Helena-West Helena	AR	11109
Henderson	AR	0
Hensley	AR	139
Hermitage	AR	804
Hickory Ridge	AR	261
Higden	AR	117
Higginson	AR	653
Highfill	AR	632
Highland	AR	1054
Hindsville	AR	61
Hiwasse	AR	497
Holiday Island	AR	2373
Holland	AR	546
Holly Grove	AR	546
Hope	AR	9891
Horatio	AR	1058
Horseshoe Bend	AR	2092
Horseshoe Lake	AR	278
Hot Springs	AR	35635
Hot Springs Village	AR	12807
Houston	AR	169
Hoxie	AR	2680
Hughes	AR	1323
Humnoke	AR	281
Humphrey	AR	524
Hunter	AR	98
Huntington	AR	626
Huntsville	AR	2378
Huttig	AR	564
Imboden	AR	640
Indian Bay	AR	0
Ivan	AR	0
Jacksonport	AR	203
Jacksonville	AR	28643
Jasper	AR	449
Jennette	AR	110
Jericho	AR	113
Jerome	AR	39
Jerusalem	AR	0
Johnson	AR	3634
Joiner	AR	540
Jones Mills	AR	90
Jonesboro	AR	73907
Judsonia	AR	2027
Junction	AR	0
Junction City	AR	547
Keiser	AR	704
Kensett	AR	1651
Keo	AR	259
Kibler	AR	943
Kingsland	AR	420
Kingston	AR	0
Kirby	AR	786
Knobel	AR	269
Knoxville	AR	746
La Grange	AR	89
Lacey	AR	0
Lafe	AR	461
LaGrange	AR	0
Lake	AR	0
Lake City	AR	2324
Lake Hamilton	AR	2135
Lake View	AR	0
Lake Village	AR	2575
Lakeview	AR	726
Lamar	AR	1668
Landmark	AR	3555
Lavaca	AR	2404
Lawson	AR	0
Leachville	AR	1868
Lead Hill	AR	274
Leola	AR	503
Lepanto	AR	1834
Leslie	AR	415
Letona	AR	255
Lewisville	AR	1181
Lexa	AR	255
Lincoln	AR	2431
Little Flock	AR	2748
Little Rock	AR	202591
Little Rock Air Force Base	AR	1291
Lockesburg	AR	741
London	AR	1046
Lonoke	AR	4249
Lonsdale	AR	95
Lost Bridge	AR	0
Lost Bridge Village	AR	434
Louann	AR	154
Lowell	AR	8549
Luxora	AR	1102
Lynn	AR	277
Madison	AR	707
Magazine	AR	823
Magness	AR	202
Magnet Cove	AR	5
Magnolia	AR	11669
Malvern	AR	10928
Mammoth Spring	AR	969
Manila	AR	3736
Mansfield	AR	1096
Marble Falls	AR	781
Marianna	AR	3766
Marie	AR	79
Marion	AR	12292
Marked Tree	AR	2501
Marmaduke	AR	1216
Marshall	AR	1300
Marvell	AR	1047
Maumelle	AR	17931
Mayflower	AR	2431
Maynard	AR	417
Maysville	AR	130
McAlmont	AR	1873
McCaskill	AR	94
McCrory	AR	1601
McDougal	AR	175
McGehee	AR	3919
McNab	AR	66
McNeil	AR	497
McRae	AR	680
Melbourne	AR	1779
Mellwood	AR	0
Mena	AR	5653
Menifee	AR	305
Midland	AR	321
Midway	AR	1084
Mineral Springs	AR	1161
Minturn	AR	103
Mitchellville	AR	332
Monette	AR	1527
Monroe	AR	0
Monticello	AR	9820
Montrose	AR	335
Moorefield	AR	137
Moro	AR	197
Morrilton	AR	6738
Morrison Bluff	AR	62
Morrow	AR	0
Mount Holly	AR	0
Mount Ida	AR	1025
Mount Judea	AR	0
Mount Olive	AR	0
Mount Pleasant	AR	403
Mount Vernon	AR	148
Mountain Home	AR	12330
Mountain Pine	AR	778
Mountain View	AR	2837
Mountainburg	AR	619
Mulberry	AR	1634
Murfreesboro	AR	1580
Nashville	AR	4479
Natural Steps	AR	426
New Blaine	AR	174
New Edinburg	AR	127
Newark	AR	1177
Newhope	AR	0
Newport	AR	7767
Nimmons	AR	65
Norfork	AR	499
Norman	AR	359
Norphlet	AR	824
North Crossett	AR	3119
North Little Rock	AR	66504
O'Kean	AR	188
Oak Grove	AR	0
Oak Grove Heights	AR	991
Oakgrove	AR	238
Oakhaven	AR	62
Oakland	AR	0
Oark	AR	0
Oden	AR	220
Ogden	AR	171
Oil Trough	AR	260
Okolona	AR	143
Ola	AR	1250
Omaha	AR	171
Oneida	AR	0
Oppelo	AR	766
Osceola	AR	7233
Oxford	AR	647
Ozan	AR	83
Ozark	AR	3590
Ozark Acres	AR	0
Ozone	AR	0
Palestine	AR	623
Pangburn	AR	602
Paragould	AR	27900
Paris	AR	3443
Parkdale	AR	265
Parkin	AR	1105
Patmos	AR	62
Patterson	AR	414
Payneway	AR	0
Pea Ridge	AR	5242
Peach Orchard	AR	127
Pearcy	AR	0
Pelsor	AR	604
Pencil Bluff	AR	0
Perla	AR	241
Perry	AR	266
Perrytown	AR	266
Perryville	AR	1432
Piggott	AR	3655
Pindall	AR	106
Pine Bluff	AR	44772
Pineville	AR	230
Piney	AR	4699
Plainview	AR	598
Pleasant Grove	AR	0
Pleasant Plains	AR	348
Plumerville	AR	805
Pocahontas	AR	6438
Pollard	AR	208
Ponca	AR	0
Poplar Grove	AR	0
Portia	AR	420
Portland	AR	412
Pottsville	AR	3082
Powhatan	AR	69
Poyen	AR	291
Prairie Creek	AR	2066
Prairie Grove	AR	5186
Prattsville	AR	306
Prescott	AR	3133
Princeton	AR	0
Pyatt	AR	216
Quitman	AR	742
Ratcliff	AR	196
Ravenden	AR	450
Ravenden Springs	AR	118
Reader	AR	66
Rector	AR	1840
Redfield	AR	1541
Reed	AR	157
Reyno	AR	442
Rison	AR	1282
Rivervale	AR	0
Rockport	AR	753
Rockwell	AR	3780
Roe	AR	104
Rogers	AR	63159
Roland	AR	746
Rondo	AR	180
Rose Bud	AR	482
Rosston	AR	249
Rover	AR	0
Rudy	AR	60
Russell	AR	216
Russellville	AR	29166
Rye	AR	146
Saint Charles	AR	230
Saint Francis	AR	250
Saint Joe	AR	132
Saint Paul	AR	113
Salado	AR	0
Salem	AR	2607
Salesville	AR	450
Saratoga	AR	0
Sardis	AR	0
Scott	AR	72
Scranton	AR	221
Searcy	AR	24196
Sedgwick	AR	146
Shannon Hills	AR	3786
Sheridan	AR	4812
Sherrill	AR	77
Sherwood	AR	30517
Shirley	AR	282
Sidney	AR	185
Siloam Springs	AR	16081
Smackover	AR	1782
Smithville	AR	72
South Lead Hill	AR	102
Southside	AR	2231
Sparkman	AR	401
Springdale	AR	77859
Springfield	AR	0
Springtown	AR	91
St. Charles	AR	0
St. Francis	AR	0
St. Joe	AR	0
St. Paul	AR	0
Stamps	AR	1551
Star	AR	0
Star City	AR	2180
State University	AR	303
Staves	AR	116
Stephens	AR	827
Strawberry	AR	290
Strong	AR	558
Stuttgart	AR	9056
Subiaco	AR	562
Success	AR	140
Sulphur Rock	AR	457
Sulphur Springs	AR	1101
Summers	AR	0
Summit	AR	579
Sunset	AR	329
Sweet Home	AR	849
Swifton	AR	756
Taylor	AR	545
Texarkana	AR	30353
Thornton	AR	398
Tillar	AR	222
Tinsman	AR	53
Toad Suck	AR	288
Tollette	AR	232
Tontitown	AR	2811
Traskwood	AR	543
Trumann	AR	7145
Tucker	AR	0
Tuckerman	AR	1759
Tull	AR	450
Tumbling Shoals	AR	978
Tupelo	AR	170
Turrell	AR	575
Twin Groves	AR	341
Tyronza	AR	744
Ulm	AR	164
Uniontown	AR	0
Urbana	AR	0
Valley Springs	AR	184
Van Buren	AR	23081
Vandervoort	AR	85
Vanndale	AR	0
Victoria	AR	35
Vilonia	AR	4439
Viola	AR	337
Violet Hill	AR	0
Wabbaseka	AR	234
Walcott	AR	0
Waldenburg	AR	60
Waldo	AR	1301
Waldron	AR	3442
Walnut Ridge	AR	4673
Ward	AR	4704
Warm Springs	AR	0
Warren	AR	5804
Washington	AR	176
Watson	AR	193
Wayton	AR	0
Weiner	AR	688
Weldon	AR	71
Wesley	AR	0
West Crossett	AR	1256
West Fork	AR	2543
West Helena	AR	7679
West Memphis	AR	25052
West Point	AR	185
Western Grove	AR	364
Wheatley	AR	328
Whelen Springs	AR	89
White Hall	AR	5180
Wickes	AR	734
Widener	AR	252
Wiederkehr	AR	0
Wiederkehr Village	AR	37
Wilburn	AR	0
Williford	AR	73
Willisville	AR	145
Wilmar	AR	508
Wilmot	AR	518
Wilson	AR	871
Wilton	AR	355
Winchester	AR	166
Winslow	AR	421
Winthrop	AR	182
Witts Springs	AR	0
Woodlawn	AR	0
Woodson	AR	403
Wooster	AR	999
Wrightsville	AR	2260
Wynne	AR	8193
Yarborough Landing	AR	487
Yellville	AR	1169
Zinc	AR	104
Aguila	AZ	798
Ahwatukee Foothills	AZ	83464
Ajo	AZ	3304
Ak Chin	AZ	30
Ak-Chin	AZ	0
Ak-Chin Village	AZ	862
Alamo Lake	AZ	0
Alhambra	AZ	127764
Ali Chuk	AZ	161
Ali Chukson	AZ	132
Ali Molina	AZ	71
Allah	AZ	100
Alpine	AZ	145
Amado	AZ	295
Anegam	AZ	151
Antares	AZ	126
Anthem	AZ	21700
Apache Junction	AZ	38074
Arivaca	AZ	695
Arivaca Junction	AZ	1090
Arizona	AZ	0
Arizona City	AZ	10475
Arizona Village	AZ	946
Arlington	AZ	194
Ash Fork	AZ	396
Avenue B and C	AZ	4176
Avondale	AZ	80684
Avra Valley	AZ	6050
Aztec	AZ	47
Bagdad	AZ	1876
Bear Flat	AZ	18
Beaver Dam	AZ	1962
Beaver Valley	AZ	0
Bellemont	AZ	0
Benson	AZ	4888
Beyerville	AZ	177
Big Park	AZ	6695
Bisbee	AZ	5208
Bitter Springs	AZ	452
Black Canyon	AZ	0
Black Canyon City	AZ	2837
Blackwater	AZ	1062
Blue Ridge	AZ	0
Bluewater	AZ	725
Bouse	AZ	996
Bowie	AZ	449
Brenda	AZ	676
Bryce	AZ	175
Buckeye	AZ	50876
Buckshot	AZ	153
Bullhead	AZ	0
Bullhead City	AZ	39445
Burnside	AZ	537
Bylas	AZ	1962
Cactus Flat	AZ	1518
Cactus Flats	AZ	0
Cactus Forest	AZ	594
Cameron	AZ	885
Camp Verde	AZ	11155
Campo Bonito	AZ	74
Cane Beds	AZ	448
Canyon Day	AZ	1209
Carefree	AZ	3610
Carrizo	AZ	127
Casa Blanca	AZ	1388
Casa Grande	AZ	51460
Casas Adobes	AZ	66795
Catalina	AZ	7569
Catalina Foothills	AZ	50796
Cave Creek	AZ	5341
Cedar Creek	AZ	318
Centennial Park	AZ	1264
Central	AZ	645
Central City	AZ	58161
Central Heights-Midland	AZ	0
Central Heights-Midland City	AZ	2534
Chandler	AZ	260828
Charco	AZ	52
Chiawuli Tak	AZ	78
Chilchinbito	AZ	506
Chinle	AZ	4518
Chino Valley	AZ	11137
Chloride	AZ	271
Christopher Creek	AZ	156
Chuichu	AZ	269
Cibecue	AZ	1713
Cibola	AZ	250
Cienega Springs	AZ	1798
Circle	AZ	0
Citrus Park	AZ	4028
Clacks Canyon	AZ	173
Clarkdale	AZ	4240
Clay Springs	AZ	401
Claypool	AZ	1538
Clifton	AZ	3685
Colorado	AZ	0
Colorado City	AZ	4832
Comobabi	AZ	8
Concho	AZ	38
Congress	AZ	1975
Coolidge	AZ	12297
Copper Hill	AZ	108
Cordes Lakes	AZ	2633
Cornfields	AZ	255
Cornville	AZ	3280
Corona de Tucson	AZ	5675
Cottonwood	AZ	11818
Cowlic	AZ	135
Crozier	AZ	14
Crystal Beach	AZ	279
Cutter	AZ	74
Dateland	AZ	416
Deer Creek	AZ	0
Deer Valley	AZ	165656
Del Muerto	AZ	329
Dennehotso	AZ	746
Desert Hills	AZ	2245
Dewey-Humboldt	AZ	3894
Dilkon	AZ	1184
Dolan Springs	AZ	2033
Doney Park	AZ	0
Donovan Estates	AZ	1508
Douglas	AZ	16592
Dragoon	AZ	209
Drexel Heights	AZ	27749
Dripping Springs	AZ	0
Drysdale	AZ	272
Dudleyville	AZ	959
Duncan	AZ	799
Eagar	AZ	4869
East Fork	AZ	699
East Globe	AZ	0
East Sahuarita	AZ	1622
East Verde Estates	AZ	170
Ehrenberg	AZ	1470
El Capitan	AZ	0
El Mirage	AZ	33935
El Prado Estates	AZ	504
Elephant Head	AZ	0
Elfrida	AZ	459
Elgin	AZ	161
Eloy	AZ	17059
Encanto	AZ	54614
First Mesa	AZ	1555
Flagstaff	AZ	70320
Florence	AZ	31110
Flowing Springs	AZ	42
Flowing Wells	AZ	16419
Forest Lakes	AZ	0
Fort Apache	AZ	143
Fort Defiance	AZ	3624
Fort Mohave	AZ	0
Fort Thomas	AZ	374
Fort Valley	AZ	0
Fortuna Foothills	AZ	26265
Fountain Hills	AZ	23899
Franklin	AZ	92
Fredonia	AZ	1322
Freedom Acres	AZ	84
Gadsden	AZ	678
Ganado	AZ	1210
Geronimo Estates	AZ	60
Gila Bend	AZ	2025
Gila Crossing	AZ	621
Gilbert	AZ	247542
Gisela	AZ	570
Glendale	AZ	240126
Globe	AZ	7396
Gold Camp	AZ	10159
Gold Canyon	AZ	10159
Golden Shores	AZ	2047
Golden Valley	AZ	8370
Goodyear	AZ	79003
Grand Canyon	AZ	1460
Grand Canyon Village	AZ	1550
Grand Canyon West	AZ	0
Greasewood	AZ	547
Green Valley	AZ	21391
Greenehaven	AZ	0
Greer	AZ	41
Gu Oidak	AZ	188
Guadalupe	AZ	6177
Hackberry	AZ	68
Haigler Creek	AZ	19
Haivana Nakya	AZ	96
Hard Rock	AZ	0
Hayden	AZ	650
Heber-Overgaard	AZ	2822
Holbrook	AZ	5019
Hondah	AZ	812
Hotevilla-Bacavi	AZ	957
Houck	AZ	1024
Huachuca	AZ	0
Huachuca City	AZ	1755
Hunter Creek	AZ	0
Icehouse Canyon	AZ	0
Indian Wells	AZ	255
J-Six Ranchettes	AZ	0
Jakes Corner	AZ	76
Jeddito	AZ	293
Jerome	AZ	456
Joseph	AZ	0
Joseph City	AZ	1386
Kachina	AZ	0
Kachina Village	AZ	2622
Kaibab	AZ	124
Kaibab Estates West	AZ	0
Kaibito	AZ	1522
Kaka	AZ	141
Katherine	AZ	103
Kayenta	AZ	5189
Keams Canyon	AZ	304
Kearny	AZ	2038
Kingman	AZ	28912
Kino Springs	AZ	136
Klagetoh	AZ	242
Kleindale	AZ	0
Ko Vaya	AZ	46
Kohatk	AZ	27
Kohls Ranch	AZ	46
Komatke	AZ	821
Kykotsmovi	AZ	0
Kykotsmovi Village	AZ	746
La Paz Valley	AZ	699
Lake Havasu	AZ	0
Lake Havasu City	AZ	53553
Lake Montezuma	AZ	4706
Lake of the Woods	AZ	4094
Laveen	AZ	5930
Lazy Y U	AZ	428
LeChee	AZ	1443
Leupp	AZ	951
Linden	AZ	2597
Litchfield Park	AZ	5533
Littlefield	AZ	308
Littletown	AZ	873
Low Mountain	AZ	757
Lower Santan	AZ	0
Lukachukai	AZ	1701
Lupton	AZ	25
Maish Vaya	AZ	158
Mammoth	AZ	1487
Many Farms	AZ	1348
Marana	AZ	41315
Maricopa	AZ	48602
Maricopa Colony	AZ	0
Martinez Lake	AZ	0
Maryvale	AZ	208189
Mayer	AZ	1497
McConnico	AZ	70
McNary	AZ	528
McNeal	AZ	238
Mead Ranch	AZ	0
Meadview	AZ	1224
Mesa	AZ	471825
Mesa del Caballo	AZ	765
Mescal	AZ	1812
Mesquite Creek	AZ	416
Miami	AZ	1783
Miracle Valley	AZ	644
Moccasin	AZ	89
Moenkopi	AZ	964
Mohave Valley	AZ	2616
Mojave Ranch Estates	AZ	52
Morenci	AZ	1489
Mormon Lake	AZ	0
Morristown	AZ	227
Mountain View Ranches	AZ	0
Mountainaire	AZ	1119
Munds Park	AZ	631
Naco	AZ	1046
Nazlini	AZ	489
Nelson	AZ	259
New Kingman-Butler	AZ	12134
New River	AZ	14952
Nogales	AZ	20252
Nolic	AZ	37
North Fork	AZ	1417
Nutrioso	AZ	26
Oak Creek Canyon	AZ	0
Oak Springs	AZ	63
Oatman	AZ	135
Oljato-Monument Valley	AZ	154
Oracle	AZ	3686
Orange Grove Mobile Manor	AZ	594
Oro Valley	AZ	45303
Oxbow Estates	AZ	217
Padre Ranchitos	AZ	171
Page	AZ	7490
Palominas	AZ	212
Paradise Valley	AZ	13922
Parker	AZ	3046
Parker Strip	AZ	662
Parks	AZ	1188
Patagonia	AZ	890
Paulden	AZ	5231
Payson	AZ	15345
Peach Springs	AZ	1090
Peeples Valley	AZ	428
Peoria	AZ	190985
Peridot	AZ	1350
Phoenix	AZ	1650070
Picacho	AZ	471
Picture Rocks	AZ	9563
Pima	AZ	2524
Pimaco Two	AZ	682
Pinal	AZ	439
Pine	AZ	1963
Pine Lake	AZ	0
Pinedale	AZ	487
Pinetop Country Club	AZ	0
Pinetop-Lakeside	AZ	4345
Pinion Pines	AZ	186
Pinon	AZ	904
Pirtleville	AZ	1744
Pisinemo	AZ	321
Poston	AZ	285
Prescott	AZ	41899
Prescott Valley	AZ	42197
Quartzsite	AZ	3626
Queen Creek	AZ	34614
Queen Valley	AZ	788
Rainbow	AZ	0
Rainbow City	AZ	968
Rancho Mesa Verde	AZ	625
Red Lake	AZ	0
Red Mesa	AZ	480
Red Rock	AZ	169
Rillito	AZ	97
Rincon Valley	AZ	0
Rio Rico	AZ	18962
Rio Verde	AZ	1811
Rock House	AZ	50
Rock Point	AZ	642
Roosevelt	AZ	28
Roosevelt Estates	AZ	0
Rough Rock	AZ	414
Round Rock	AZ	789
Round Valley	AZ	0
Rye	AZ	77
Sacate	AZ	0
Sacaton	AZ	2672
Sacaton Flats	AZ	0
Saddlebrooke	AZ	12574
Safford	AZ	9683
Sahuarita	AZ	25707
Saint David	AZ	1699
Saint Johns	AZ	3480
Saint Michaels	AZ	1443
Salome	AZ	1530
San Carlos	AZ	4103
San Jose	AZ	506
San Luis	AZ	31520
San Manuel	AZ	3551
San Miguel	AZ	197
San Simon	AZ	165
San Tan Valley	AZ	81321
Sanders	AZ	630
Santa Cruz	AZ	37
Santa Rosa	AZ	628
Santan	AZ	883
Sawmill	AZ	748
Scenic	AZ	1643
Scottsdale	AZ	236839
Seba Dalkai	AZ	136
Second Mesa	AZ	962
Sedona	AZ	10388
Sehili	AZ	135
Seligman	AZ	445
Sells	AZ	2495
Seven Mile	AZ	0
Sevenmile	AZ	707
Shongopovi	AZ	831
Shonto	AZ	591
Show Low	AZ	10860
Shumway	AZ	0
Shungopavi	AZ	730
Sierra Vista	AZ	43355
Sierra Vista Southeast	AZ	14797
Six Shooter Canyon	AZ	1019
Snowflake	AZ	5666
So-Hi	AZ	477
Solomon	AZ	426
Somerton	AZ	15048
Sonoita	AZ	818
South Komelik	AZ	111
South Tucson	AZ	5715
Spring Valley	AZ	1148
Springerville	AZ	1954
St. David	AZ	0
St. Johns	AZ	0
St. Michaels	AZ	0
Stanfield	AZ	740
Star Valley	AZ	2277
Steamboat	AZ	284
Stotonic	AZ	0
Strawberry	AZ	961
Summerhaven	AZ	40
Summit	AZ	5372
Sun	AZ	0
Sun City	AZ	37499
Sun City West	AZ	24535
Sun Lakes	AZ	13975
Sun Valley	AZ	1755
Sunizona	AZ	281
Sunsites	AZ	0
Sunwest	AZ	15
Supai	AZ	208
Superior	AZ	2943
Surprise	AZ	143148
Sweet Water	AZ	0
Swift Trail Junction	AZ	2935
Tacna	AZ	602
Tanque Verde	AZ	16901
Tat Momoli	AZ	10
Taylor	AZ	4151
Teec Nos Pos	AZ	730
Tees Toh	AZ	448
Tempe	AZ	175826
Tempe Junction	AZ	158368
Thatcher	AZ	4992
Theba	AZ	158
Three Points	AZ	5581
Timberline-Fernwood	AZ	0
Tolani Lake	AZ	280
Tolleson	AZ	7008
Tombstone	AZ	1312
Tonalea	AZ	549
Tonopah	AZ	60
Tonto	AZ	0
Tonto Basin	AZ	1424
Tonto Village	AZ	256
Top-of-the-World	AZ	231
Topawa	AZ	299
Topock	AZ	10
Tortolita	AZ	4274
Toyei	AZ	13
Truxton	AZ	134
Tsaile	AZ	1205
Tuba	AZ	0
Tuba City	AZ	8611
Tubac	AZ	1191
Tucson	AZ	542629
Tucson Estates	AZ	12192
Tucson Mountains	AZ	0
Tumacacori-Carmen	AZ	393
Turkey Creek	AZ	294
Tusayan	AZ	567
Upper Santan	AZ	0
Utting	AZ	126
Vail	AZ	10208
Vaiva Vo	AZ	128
Valencia West	AZ	9355
Valentine	AZ	38
Valle	AZ	832
Valle Vista	AZ	1659
Ventana	AZ	49
Verde	AZ	0
Verde Village	AZ	11605
Vernon	AZ	122
Vicksburg	AZ	597
Village of Oak Creek (Big Park)	AZ	6147
Wagon Wheel	AZ	0
Wahak Hotrontk	AZ	114
Wall Lane	AZ	415
Walnut Creek	AZ	562
Washington Park	AZ	70
Wellton	AZ	2936
Wellton Hills	AZ	0
Wenden	AZ	728
West Sedona	AZ	11299
West Winslow	AZ	150
Wet Camp	AZ	0
Wheatfields	AZ	0
Whetstone	AZ	2617
Whispering Pines	AZ	148
White Cone	AZ	817
White Hills	AZ	323
White Mountain Lake	AZ	2205
Whitecone	AZ	0
Whiteriver	AZ	4104
Why	AZ	167
Wickenburg	AZ	6806
Wide Ruins	AZ	176
Wikieup	AZ	133
Wilhoit	AZ	868
Willcox	AZ	3552
Williams	AZ	3122
Williamson	AZ	5438
Willow Canyon	AZ	1
Willow Valley	AZ	1062
Window Rock	AZ	2712
Winkelman	AZ	346
Winslow	AZ	9600
Winslow West	AZ	438
Wintersburg	AZ	136
Wittmann	AZ	763
Woodruff	AZ	191
Yarnell	AZ	649
York	AZ	557
Young	AZ	666
Youngtown	AZ	6613
Yucca	AZ	126
Yuma	AZ	95548
Yuma Proving Ground	AZ	0
Acalanes Ridge	CA	1137
Acampo	CA	341
Acton	CA	7596
Adelanto	CA	33166
Adin	CA	272
Agoura	CA	20537
Agoura Hills	CA	20915
Agua Caliente	CA	27090
Agua Dulce	CA	3342
Aguanga	CA	1128
Ahwahnee	CA	2246
Airport	CA	0
Alameda	CA	78630
Alamo	CA	14570
Albany	CA	19735
Albion	CA	168
Alderpoint	CA	186
Alhambra	CA	85551
Alhambra Valley	CA	0
Aliso Viejo	CA	50195
Alleghany	CA	58
Allendale	CA	1506
Allensworth	CA	471
Almanor	CA	0
Alondra Park	CA	8592
Alpaugh	CA	1026
Alpine	CA	14236
Alpine Village	CA	146
Alta	CA	610
Alta Sierra	CA	7047
Altadena	CA	42777
Alto	CA	711
Alturas	CA	2594
Alum Rock	CA	15536
Amador	CA	0
Amador City	CA	189
Amador Pines	CA	0
American Canyon	CA	20554
Amesti	CA	3478
Anaheim	CA	350742
Anchor Bay	CA	340
Anderson	CA	10217
Angels	CA	0
Angels Camp	CA	2677
Angwin	CA	3051
Antelope	CA	45770
Antioch	CA	110542
Anza	CA	3014
Apple Valley	CA	72174
Aptos	CA	6220
Aptos Hills-Larkin Valley	CA	2381
Arbuckle	CA	3028
Arcadia	CA	58408
Arcata	CA	17843
Arden-Arcade	CA	92186
Armona	CA	4156
Arnold	CA	3843
Aromas	CA	2650
Arroyo Grande	CA	18108
Artesia	CA	16961
Artois	CA	295
Arvin	CA	20876
Ashland	CA	21925
Aspen Springs	CA	65
Atascadero	CA	29819
Atherton	CA	7167
Atwater	CA	29237
Atwater Village	CA	15455
Auberry	CA	2369
Auburn	CA	13776
Auburn Lake Trails	CA	3426
August	CA	8390
Avalon	CA	3799
Avenal	CA	13301
Avery	CA	646
Avila Beach	CA	1627
Avocado Heights	CA	15411
Azusa	CA	49690
Baker	CA	735
Bakersfield	CA	373640
Bakersfield Country Club	CA	0
Baldwin Park	CA	77071
Ballard	CA	467
Ballico	CA	406
Bangor	CA	646
Banning	CA	30945
Barstow	CA	23692
Barstow Heights	CA	24202
Bass Lake	CA	527
Bay Point	CA	21534
Bayside	CA	17132
Bayview	CA	2510
Bayview-Hunters Point	CA	34835
Baywood Park	CA	0
Beale AFB	CA	0
Beale Air Force Base	CA	1319
Bear Creek	CA	290
Bear Valley	CA	125
Bear Valley Springs	CA	5172
Beaumont	CA	43811
Beckwourth	CA	432
Bel Air	CA	8253
Belden	CA	22
Bell	CA	36205
Bell Canyon	CA	0
Bell Gardens	CA	43106
Bella Vista	CA	2781
Bellflower	CA	78441
Belmont	CA	27218
Belvedere	CA	2121
Ben Lomond	CA	6234
Benbow	CA	321
Bend	CA	619
Benicia	CA	28167
Benton	CA	280
Benton Park	CA	0
Berkeley	CA	120972
Bermuda Dunes	CA	7282
Berry Creek	CA	1424
Bertsch-Oceanview	CA	2436
Bethel Island	CA	2137
Beverly Hills	CA	34869
Bieber	CA	312
Big Bear	CA	0
Big Bear City	CA	12304
Big Bear Lake	CA	5213
Big Bend	CA	102
Big Creek	CA	175
Big Lagoon	CA	93
Big Pine	CA	1756
Big River	CA	1327
Big Sur	CA	1000
Biggs	CA	1704
Biola	CA	1623
Bishop	CA	3806
Black Point-Green Point	CA	1306
Blackhawk	CA	9354
Blacklake	CA	930
Blairsden	CA	39
Bloomfield	CA	345
Bloomington	CA	23851
Blue Lake	CA	1252
Bluewater	CA	172
Blythe	CA	19208
Bodega	CA	220
Bodega Bay	CA	1077
Bodfish	CA	1956
Bolinas	CA	1620
Bombay Beach	CA	295
Bonadelle Ranchos	CA	0
Bonadelle Ranchos-Madera Ranchos	CA	8569
Bonita	CA	12538
Bonny Doon	CA	2678
Bonsall	CA	3982
Boonville	CA	1035
Bootjack	CA	960
Boron	CA	2253
Boronda	CA	1710
Borrego Springs	CA	3429
Bostonia	CA	15379
Boulder Creek	CA	4923
Boulevard	CA	315
Bowles	CA	166
Boyes Hot Springs	CA	6656
Boyle Heights	CA	92785
Bradbury	CA	1089
Bradley	CA	93
Brawley	CA	25897
Brea	CA	41944
Brentwood	CA	58968
Bret Harte	CA	5152
Bridgeport	CA	575
Brisbane	CA	4717
Broadmoor	CA	4176
Brookdale	CA	1991
Brooks	CA	0
Brooktrails	CA	3235
Buck Meadows	CA	31
Buckhorn	CA	2429
Bucks Lake	CA	10
Buellton	CA	5082
Buena Park	CA	83270
Buena Vista	CA	1704
Burbank	CA	105319
Burlingame	CA	30459
Burney	CA	3154
Burnt Ranch	CA	281
Butte Creek Canyon	CA	0
Butte Meadows	CA	40
Butte Valley	CA	0
Buttonwillow	CA	1508
Byron	CA	1277
Bystrom	CA	4008
C-Road	CA	150
Cabazon	CA	2535
Calabasas	CA	23058
Calexico	CA	40053
California	CA	0
California City	CA	13277
California Hot Springs	CA	37
California Pines	CA	520
California Polytechnic State University	CA	0
Calimesa	CA	8542
Calipatria	CA	7424
Calistoga	CA	5330
Callender	CA	1262
Calpella	CA	679
Calpine	CA	205
Calwa	CA	818
Camanche	CA	0
Camanche North Shore	CA	979
Camanche Village	CA	847
Camarillo	CA	67608
Cambria	CA	6032
Cambrian Park	CA	3282
Cameron Park	CA	18228
Camino	CA	1750
Camino Tassajara	CA	0
Camp Meeker	CA	2461
Camp Nelson	CA	97
Camp Pendleton Mainside	CA	0
Camp Pendleton North	CA	5200
Camp Pendleton South	CA	10616
Campbell	CA	41117
Campo	CA	2684
Campo Seco	CA	0
Camptonville	CA	158
Canby	CA	315
Canoga Park	CA	60578
Cantua Creek	CA	466
Canyon Country	CA	59530
Canyon Lake	CA	11080
Canyondam	CA	31
Capitola	CA	10189
Caribou	CA	0
Carlsbad	CA	114746
Carmel Valley	CA	0
Carmel Valley Village	CA	4407
Carmel-by-the-Sea	CA	3897
Carmet	CA	47
Carmichael	CA	61762
Carnelian Bay	CA	524
Carpinteria	CA	13727
Carrick	CA	131
Carson	CA	93281
Cartago	CA	92
Caruthers	CA	2497
Casa Conejo	CA	3249
Casa de Oro-Mount Helix	CA	18762
Casa Loma	CA	0
Casmalia	CA	138
Caspar	CA	509
Cassel	CA	207
Castaic	CA	19015
Castella	CA	0
Castle Hill	CA	0
Castro Valley	CA	61388
Castroville	CA	6481
Cathedral	CA	0
Cathedral City	CA	53826
Catheys Valley	CA	825
Cayucos	CA	2592
Cazadero	CA	354
Cedar Flat	CA	0
Cedar Ridge	CA	1132
Cedar Slope	CA	0
Cedarville	CA	514
Centerville	CA	392
Central Valley (historical)	CA	4340
Century City	CA	5513
Ceres	CA	47963
Cerritos	CA	49975
Chalfant	CA	0
Challenge-Brownsville	CA	1148
Channel Islands Beach	CA	3103
Charleston View	CA	0
Charter Oak	CA	9310
Chatsworth	CA	41255
Cherokee	CA	69
Cherokee Strip	CA	227
Cherry Valley	CA	6362
Cherryland	CA	14728
Chester	CA	2144
Chico	CA	121345
Chilcoot-Vinton	CA	454
China Lake Acres	CA	1876
Chinatown	CA	100574
Chinese Camp	CA	126
Chino	CA	85595
Chino Hills	CA	78309
Choctaw Valley	CA	0
Chowchilla	CA	18510
Chualar	CA	1190
Chula Vista	CA	265757
Citrus	CA	10866
Citrus Heights	CA	87056
Claremont	CA	36283
Clarksburg	CA	418
Clay	CA	1195
Clayton	CA	11867
Clear Creek	CA	169
Clear Lake Riviera	CA	3090
Clearlake	CA	15182
Clearlake Oaks	CA	2359
Clearlake Riviera	CA	0
Cleone	CA	618
Clio	CA	66
Clipper Mills	CA	142
Cloverdale	CA	8811
Clovis	CA	104180
Clyde	CA	678
Coachella	CA	44635
Coalinga	CA	16564
Coarsegold	CA	1840
Cobb	CA	1778
Coffee Creek	CA	217
Cohasset	CA	847
Cold Springs	CA	446
Coleville	CA	495
Colfax	CA	1995
College	CA	0
College City	CA	290
Collierville	CA	1934
Colma	CA	1520
Coloma	CA	529
Colton	CA	54621
Columbia	CA	2297
Colusa	CA	5935
Commerce	CA	13081
Communications Hill	CA	11267
Comptche	CA	159
Compton	CA	98462
Concord	CA	128667
Concow	CA	710
Contra Costa Centre	CA	5364
Cool	CA	4100
Copperopolis	CA	3671
Corcoran	CA	22477
Corning	CA	7548
Corona	CA	164226
Coronado	CA	24812
Coronita	CA	0
Corralitos	CA	2326
Corte Madera	CA	9901
Costa Mesa	CA	113204
Cotati	CA	7445
Coto De Caza	CA	14866
Cottonwood	CA	3850
Coulterville	CA	201
Country Club	CA	9379
Courtland	CA	355
Covelo	CA	1255
Covina	CA	48984
Cowan	CA	0
Crescent	CA	0
Crescent City	CA	6774
Crescent Mills	CA	196
Cressey	CA	394
Crest	CA	2593
Crestline	CA	10770
Creston	CA	94
Crockett	CA	3094
Cromberg	CA	261
Crowley Lake	CA	0
Crows Landing	CA	355
Cudahy	CA	24311
Culver	CA	0
Culver City	CA	39717
Cupertino	CA	60572
Cutler	CA	5000
Cutten	CA	3108
Cuyama	CA	57
Cypress	CA	49290
Cypress Village	CA	9610
Dales	CA	0
Daly	CA	0
Daly City	CA	106562
Dana Point	CA	34181
Danville	CA	44400
Daphnedale Park	CA	184
Darwin	CA	43
Davenport	CA	408
Davis	CA	67666
Day Valley	CA	3409
Death Valley	CA	1124
Deer Park	CA	1384
Del Aire	CA	10001
Del Dios	CA	0
Del Mar	CA	4351
Del Monte Forest	CA	4514
Del Rey	CA	1639
Del Rey Oaks	CA	1688
Del Rio	CA	1270
Delano	CA	52733
Delft Colony	CA	454
Delhi	CA	10755
Delleker	CA	705
Denair	CA	4404
Derby Acres	CA	322
Descanso	CA	1423
Desert Center	CA	204
Desert Edge	CA	3822
Desert Hot Springs	CA	28335
Desert Palms	CA	0
Desert Shores	CA	1104
Desert View Highlands	CA	2360
Di Giorgio	CA	0
Diablo	CA	1158
Diablo Grande	CA	826
Diamond Bar	CA	56897
Diamond Springs	CA	11037
Dillon Beach	CA	283
Dinuba	CA	23702
Discovery Bay	CA	13352
Dixon	CA	19390
Dixon Lane-Meadow Creek	CA	2645
Dixon Lane-MeadowCreek	CA	0
Dobbins	CA	624
Dogtown	CA	2506
Dollar Point	CA	1215
Dorrington	CA	609
Dorris	CA	907
Dos Palos	CA	5125
Dos Palos Y	CA	323
Douglas	CA	0
Douglas City	CA	713
Douglas Flat	CA	0
Downey	CA	114219
Downieville	CA	282
Doyle	CA	678
Drytown	CA	167
Duarte	CA	21990
Dublin	CA	57721
Ducor	CA	612
Dunnigan	CA	1416
Dunsmuir	CA	1582
Durham	CA	5518
Dustin Acres	CA	652
Dutch Flat	CA	160
Eagleville	CA	59
Earlimart	CA	8537
East Bakersfield	CA	0
East Blythe	CA	3
East Foothills	CA	8269
East Hemet	CA	17418
East La Mirada	CA	9757
East Los Angeles	CA	126496
East Nicolaus	CA	225
East Niles	CA	0
East Oakdale	CA	2762
East Orosi	CA	495
East Palo Alto	CA	29662
East Pasadena	CA	6144
East Porterville	CA	6767
East Quincy	CA	2489
East Rancho Dominguez	CA	15135
East Richmond Heights	CA	3280
East San Gabriel	CA	14874
East Shore	CA	156
East Sonora	CA	2266
East Tulare Villa	CA	778
East Whittier	CA	0
Eastern Goleta Valley	CA	0
Easton	CA	2083
Eastvale	CA	59039
Echo Park	CA	43832
Edgewood	CA	43
Edison	CA	0
Edmundson Acres	CA	279
Edna	CA	193
Edwards AFB	CA	0
Edwards Air Force Base	CA	2063
El Adobe	CA	0
El Cajon	CA	103679
El Camino Real	CA	15999
El Centro	CA	43956
El Centro Naval Air Facility	CA	0
El Cerrito	CA	23549
El Cerrito Corona	CA	5100
El Dorado Hills	CA	42108
El Granada	CA	5467
El Macero	CA	0
El Monte	CA	116732
El Monte Mobile	CA	0
El Nido	CA	330
El Paso de Robles (Paso Robles)	CA	0
El Portal	CA	474
El Rancho	CA	124
El Rio	CA	7198
El Segundo	CA	17037
El Sobrante	CA	12669
El Verano	CA	4123
Eldridge	CA	1233
Elfin Forest	CA	0
Elizabeth Lake	CA	0
Elk Creek	CA	163
Elk Grove	CA	166913
Elkhorn	CA	1565
Elmira	CA	188
Elverta	CA	5492
Emerald Lake Hills	CA	4278
Emeryville	CA	11694
Empire	CA	4189
Encinitas	CA	62930
Encino	CA	44581
Escalon	CA	7523
Escondido	CA	151038
Esparto	CA	3108
Etna	CA	716
Eucalyptus Hills	CA	5313
Eureka	CA	27017
Exeter	CA	10548
Fair Oaks	CA	30912
Fairbanks Ranch	CA	3148
Fairfax	CA	7626
Fairfield	CA	112970
Fairhaven	CA	0
Fairmead	CA	1447
Fairview	CA	10003
Fall River Mills	CA	573
Fallbrook	CA	30534
Farmersville	CA	10774
Farmington	CA	207
Fellows	CA	106
Felton	CA	4057
Ferndale	CA	1369
Fetters Hot Springs-Agua Caliente	CA	4144
Fiddletown	CA	235
Fieldbrook	CA	859
Fields Landing	CA	276
Fillmore	CA	15548
Firebaugh	CA	8330
Fish Camp	CA	59
Florence-Graham	CA	63387
Florin	CA	47513
Floriston	CA	73
Flournoy	CA	101
Folsom	CA	76375
Fontana	CA	212704
Foothill Farms	CA	33121
Foothill Ranch	CA	11698
Forbestown	CA	320
Ford	CA	0
Ford City	CA	4278
Forest Meadows	CA	1249
Forest Ranch	CA	1184
Foresta	CA	0
Foresthill	CA	1483
Forestville	CA	3293
Fort Bidwell	CA	173
Fort Bragg	CA	7289
Fort Dick	CA	1405
Fort Hunter Liggett	CA	0
Fort Irwin	CA	8845
Fort Jones	CA	688
Fort Washington	CA	0
Fortuna	CA	12000
Foster	CA	0
Foster City	CA	33477
Fountain Valley	CA	56987
Fowler	CA	6266
Franklin	CA	155
Frazier Park	CA	2691
Freedom	CA	3070
Freeport	CA	38
Fremont	CA	232206
French Camp	CA	3376
French Gulch	CA	346
French Valley	CA	0
Fresno	CA	542107
Friant	CA	509
Fruitdale	CA	935
Fruitridge Pocket	CA	5800
Fuller Acres	CA	991
Fullerton	CA	140847
Fulton	CA	541
Furnace Creek	CA	24
Galt	CA	25303
Garberville	CA	913
Garden Acres	CA	10648
Garden Farms	CA	386
Garden Grove	CA	175393
Gardena	CA	60447
Garey	CA	68
Garnet	CA	7543
Gasquet	CA	661
Gazelle	CA	70
Georgetown	CA	2367
Gerber	CA	1060
Geyserville	CA	862
Gilroy	CA	53231
Glen Avon	CA	20199
Glen Ellen	CA	784
Glencoe	CA	0
Glendale	CA	201020
Glendora	CA	52009
Glennville	CA	0
Gold Mountain	CA	80
Gold River	CA	7912
Golden Hills	CA	8656
Goleta	CA	30944
Gonzales	CA	8473
Good Hope	CA	9192
Goodmanville	CA	0
Goodyears Bar	CA	68
Goshen	CA	3006
Graeagle	CA	737
Grand Terrace	CA	12464
Grangeville	CA	469
Granite Bay	CA	20402
Granite Hills	CA	3035
Graniteville	CA	11
Grass Valley	CA	12944
Graton	CA	1707
Grayson	CA	952
Greeley Hill	CA	915
Green Acres	CA	1805
Green Valley	CA	1625
Greenacres	CA	5566
Greenfield	CA	17184
Greenhorn	CA	236
Greenview	CA	201
Greenville	CA	1129
Grenada	CA	367
Gridley	CA	6582
Grimes	CA	391
Grizzly Flats	CA	0
Groveland	CA	601
Grover Beach	CA	13600
Guadalupe	CA	7318
Guerneville	CA	4534
Guinda	CA	254
Gustine	CA	5756
Hacienda Heights	CA	54038
Half Moon Bay	CA	12657
Hamilton	CA	0
Hamilton Branch	CA	537
Hamilton City	CA	1759
Hanford	CA	55659
Happy Camp	CA	1190
Happy Valley	CA	0
Harbison Canyon	CA	3841
Hardwick	CA	138
Harmony Grove	CA	0
Hartland	CA	30
Hartley	CA	2510
Hasley Canyon	CA	0
Hat Creek	CA	309
Hathaway Pines	CA	0
Hawaiian Gardens	CA	14592
Hawthorne	CA	88451
Hayfork	CA	2368
Hayward	CA	158289
Healdsburg	CA	11742
Heber	CA	4275
Hemet	CA	83861
Herald	CA	1184
Hercules	CA	25314
Herlong	CA	298
Hermosa Beach	CA	19860
Hesperia	CA	93295
Hickman	CA	641
Hidden Hills	CA	1924
Hidden Meadows	CA	3485
Hidden Trails	CA	750
Hidden Valley Lake	CA	5579
Highgrove	CA	3988
Highland	CA	54854
Highlands	CA	0
Highlands-Baywood Park	CA	4027
Hillcrest	CA	0
Hillsborough	CA	11451
Hilmar-Irwin	CA	5197
Hiouchi	CA	301
Hollister	CA	37462
Hollywood	CA	167664
Holtville	CA	6404
Home Garden	CA	1761
Home Gardens	CA	11570
Homeland	CA	5969
Homestead Valley	CA	0
Homewood Canyon	CA	0
Honcut	CA	370
Hood	CA	271
Hoopa	CA	0
Hopland	CA	756
Hornbrook	CA	248
Hornitos	CA	75
Hughson	CA	7384
Humboldt Hill	CA	3414
Huntington Beach	CA	201899
Huntington Park	CA	59430
Huron	CA	6836
Hyampom	CA	241
Hydesville	CA	1237
Hypericum	CA	0
Idlewild	CA	43
Idyllwild	CA	3583
Idyllwild-Pine Cove	CA	3874
Igo	CA	0
Imperial	CA	17095
Imperial Beach	CA	27408
Independence	CA	669
Indian Falls	CA	54
Indian Wells	CA	5289
Indianola	CA	823
Indio	CA	87533
Indio Hills	CA	972
Industry	CA	206
Inglewood	CA	111666
Interlaken	CA	7321
Inverness	CA	1304
Inyokern	CA	1099
Ione	CA	7000
Iron Horse	CA	297
Irvine	CA	256927
Irvine Health and Science Complex	CA	8644
Irwindale	CA	1437
Isla Vista	CA	23096
Isleton	CA	834
Ivanhoe	CA	4495
Jackson	CA	4649
Jacumba	CA	0
Jacumba Hot Springs	CA	561
Jamestown	CA	3433
Jamul	CA	6163
Janesville	CA	1408
Jenner	CA	136
Johannesburg	CA	172
Johnson Park	CA	0
Johnstonville	CA	1024
Johnsville	CA	20
Jones Valley	CA	0
Joshua Tree	CA	7414
Jovista	CA	0
Julian	CA	1502
Junction	CA	0
Junction City	CA	680
June Lake	CA	629
Jurupa Valley	CA	21930
Keddie	CA	66
Keeler	CA	66
Keene	CA	431
Kelly Ridge	CA	0
Kelseyville	CA	3353
Kennedy	CA	3254
Kennedy Meadows	CA	0
Kensington	CA	5077
Kentfield	CA	6485
Kenwood	CA	1028
Kep'el	CA	0
Kerman	CA	14475
Kernville	CA	1395
Keswick	CA	451
Kettleman	CA	0
Kettleman City	CA	1439
Keyes	CA	5601
King	CA	0
King City	CA	13902
Kings Beach	CA	3796
Kingsburg	CA	11824
Kingvale	CA	143
Kirkwood	CA	158
Klamath	CA	779
Knights Ferry	CA	0
Knights Landing	CA	995
Knightsen	CA	1568
Koreatown	CA	124281
Kyburz	CA	167
La CaÃ±ada Flintridge	CA	0
La Cañada Flintridge	CA	20246
La Crescenta-Montrose	CA	19653
La Cresta	CA	0
La Grange	CA	0
La Habra	CA	62131
La Habra Heights	CA	5454
La Honda	CA	928
La Jolla	CA	42808
La Mesa	CA	60089
La Mirada	CA	49520
La Palma	CA	15904
La Porte	CA	26
La Presa	CA	34169
La Puente	CA	40745
La Quinta	CA	40476
La Riviera	CA	10802
La Selva Beach	CA	2843
La Verne	CA	32681
La Vina	CA	279
Ladera	CA	1426
Ladera Heights	CA	6498
Ladera Ranch	CA	22980
Lafayette	CA	25843
Laguna	CA	46621
Laguna Beach	CA	23365
Laguna Hills	CA	31748
Laguna Niguel	CA	65806
Laguna Woods	CA	16406
Lagunitas-Forest Knolls	CA	1819
Lake	CA	0
Lake Almanor Country Club	CA	419
Lake Almanor Peninsula	CA	356
Lake Almanor West	CA	270
Lake Arrowhead	CA	12424
Lake California	CA	0
Lake City	CA	61
Lake Davis	CA	45
Lake Don Pedro	CA	0
Lake Elsinore	CA	61981
Lake Forest	CA	82492
Lake Hughes	CA	649
Lake Isabella	CA	3466
Lake Los Angeles	CA	12328
Lake Mathews	CA	0
Lake Nacimiento	CA	2411
Lake of the Pines	CA	3917
Lake of the Woods	CA	917
Lake Riverside	CA	0
Lake San Marcos	CA	4437
Lake Shastina	CA	0
Lake Sherwood	CA	0
Lake Wildwood	CA	4991
Lakehead	CA	461
Lakeland	CA	0
Lakeland Village	CA	11541
Lakeport	CA	4807
Lakeside	CA	20648
Lakeview	CA	2104
Lakewood	CA	81611
Lamont	CA	15120
Lanare	CA	589
Lancaster	CA	161103
Larchmont	CA	9195
Larkfield-Wikiup	CA	8884
Larkspur	CA	12417
Las Flores	CA	6037
Las Lomas	CA	3024
Lathrop	CA	20866
Laton	CA	1824
Lawndale	CA	33430
Laytonville	CA	1227
Le Grand	CA	1659
Lebec	CA	1468
Lee Vining	CA	222
Leggett	CA	122
Lemon Cove	CA	308
Lemon Grove	CA	26709
Lemon Hill	CA	0
Lemoore	CA	25647
Lemoore Station	CA	7438
Lennox	CA	22753
Lenwood	CA	3543
Leona Valley	CA	1607
Lewiston	CA	1193
Lexington Hills	CA	2421
Likely	CA	63
Lincoln	CA	49757
Lincoln Village	CA	4381
Linda	CA	17773
Lindcove	CA	406
Linden	CA	1784
Lindsay	CA	13217
Linnell Camp	CA	849
Litchfield	CA	195
Little Grass Valley	CA	2
Little River	CA	117
Little Valley	CA	0
Littlerock	CA	1377
Live Oak	CA	17158
Livermore	CA	88126
Livingston	CA	13902
Lockeford	CA	3233
Lockwood	CA	379
Lodi	CA	64596
Lodoga	CA	197
Loleta	CA	783
Loma Linda	CA	24045
Loma Mar	CA	113
Loma Rica	CA	2368
Lomita	CA	20785
Lompico	CA	1137
Lompoc	CA	44164
London	CA	1869
Lone Pine	CA	2035
Long Barn	CA	155
Long Beach	CA	474140
Longwood - Winton Grove	CA	6700
Lookout	CA	84
Loomis	CA	6836
Los Alamitos	CA	11449
Los Alamos	CA	1890
Los Altos	CA	30671
Los Altos Hills	CA	8419
Los Angeles	CA	3820914
Los Banos	CA	37457
Los Berros	CA	641
Los Gatos	CA	30705
Los Molinos	CA	2037
Los Olivos	CA	1132
Los Osos	CA	14276
Los Ranchos	CA	0
Los Serranos	CA	7099
Lost Hills	CA	2412
Lower Lake	CA	1294
Loyalton	CA	702
Loyola	CA	3261
Lucas Valley-Marinwood	CA	6094
Lucerne	CA	3443
Lucerne Valley	CA	5811
Lynwood	CA	71989
Lytle Creek	CA	701
Mabie	CA	161
Macdoel	CA	133
Mad River	CA	420
Madeline	CA	0
Madera	CA	64208
Madera Acres	CA	9163
Madera Ranchos	CA	0
Madison	CA	503
Magalia	CA	11310
Malaga	CA	947
Malibu	CA	12965
Mammoth Lakes	CA	7946
Manchester	CA	195
Manhattan Beach	CA	35818
Manila	CA	784
Manteca	CA	75448
Manton	CA	347
March Air Force Base	CA	1159
March ARB	CA	0
Maricopa	CA	1192
Marin	CA	0
Marin City	CA	2666
Marina	CA	21229
Marina del Rey	CA	8866
Mariposa	CA	2173
Markleeville	CA	210
Martell	CA	282
Martinez	CA	38137
Marysville	CA	12216
Matheny	CA	1212
Mather	CA	0
Maxwell	CA	1103
Mayfair	CA	0
Mayflower	CA	0
Mayflower Village	CA	5515
Maywood	CA	27888
McArthur	CA	338
McClellan Park	CA	743
McClenney Tract	CA	10
McCloud	CA	1101
McFarland	CA	13985
McGee Creek	CA	0
McKinleyville	CA	15177
McKittrick	CA	115
McSwain	CA	0
Mead Valley	CA	18510
Meadow Valley	CA	464
Meadow Vista	CA	3217
Meadowbrook	CA	3185
Mecca	CA	8577
Meiners Oaks	CA	3571
Mendocino	CA	894
Mendota	CA	11430
Menifee	CA	87174
Menlo Park	CA	33449
Mentone	CA	8720
Merced	CA	82436
Meridian	CA	358
Mesa	CA	251
Mesa Verde	CA	1023
Mesa Vista	CA	200
Mettler	CA	136
Mexican Colony	CA	281
Meyers	CA	0
Mi-Wuk	CA	0
Mi-Wuk Village	CA	941
Mid-City	CA	83000
Middletown	CA	1323
Midpines	CA	1204
Midway	CA	0
Midway City	CA	8485
Milford	CA	167
Mill Valley	CA	14394
Millbrae	CA	22795
Millerton	CA	0
Millville	CA	727
Milpitas	CA	77604
Mineral	CA	123
Minkler	CA	1003
Mira Mesa	CA	70000
Mira Monte	CA	6854
Miranda	CA	520
Mission Canyon	CA	2381
Mission District	CA	47234
Mission Hills	CA	3576
Mission Viejo	CA	97156
Modesto	CA	211266
Modjeska	CA	0
Mohawk Vista	CA	159
Mojave	CA	4238
Mokelumne Hill	CA	646
Monmouth	CA	152
Mono	CA	0
Mono City	CA	172
Mono Vista	CA	3127
Monrovia	CA	37463
Monson	CA	188
Montague	CA	1399
Montalvin	CA	2876
Montalvin Manor	CA	0
Montara	CA	2909
Montclair	CA	38690
Monte Rio	CA	1152
Monte Sereno	CA	3556
Montebello	CA	63921
Montecito	CA	8965
Monterey	CA	28338
Monterey Park	CA	61468
Monterey Park Tract	CA	0
Montgomery Creek	CA	163
Monument Hills	CA	1542
Moorpark	CA	36104
Morada	CA	3828
Moraga	CA	17256
Moreno Valley	CA	204198
Morgan Hill	CA	42948
Morongo Valley	CA	3552
Morro Bay	CA	10639
Mortmar	CA	211
Moskowite Corner	CA	211
Moss Beach	CA	3103
Moss Landing	CA	204
Mount Hebron	CA	95
Mount Hermon	CA	1037
Mount Laguna	CA	0
Mount Shasta	CA	3296
Mountain Center	CA	63
Mountain Gate	CA	943
Mountain House	CA	9675
Mountain Meadows	CA	0
Mountain Mesa	CA	777
Mountain Ranch	CA	1628
Mountain View	CA	80435
Mountain View Acres	CA	3130
Mt Laguna	CA	57
Mt. Bullion	CA	0
Muir Beach	CA	310
Murphys	CA	2213
Murrieta	CA	109830
Murrieta Hot Springs	CA	3644
Muscoy	CA	10644
Myers Flat	CA	146
Myrtletown	CA	4675
Napa	CA	80434
National	CA	0
National City	CA	61060
Needles	CA	4984
Nevada	CA	0
Nevada City	CA	3152
New Cuyama	CA	517
New Pine Creek	CA	98
Newark	CA	45336
Newcastle	CA	1224
Newell	CA	449
Newman	CA	10899
Newport Beach	CA	87127
Nicasio	CA	96
Nice	CA	2731
Nicolaus	CA	211
Niland	CA	1006
Nipinnawasee	CA	475
Nipomo	CA	16714
Noe Valley	CA	22893
Norco	CA	26289
Nord	CA	320
Norris Canyon	CA	0
North Auburn	CA	13022
North Edwards	CA	1058
North El Monte	CA	3723
North Fair Oaks	CA	14687
North Fork	CA	0
North Gate	CA	679
North Highlands	CA	42694
North Hills	CA	56946
North Hollywood	CA	64587
North Lakeport	CA	3314
North Richmond	CA	3717
North San Juan	CA	269
North Shore	CA	0
North Tustin	CA	24917
Northridge	CA	68469
Northwood	CA	22218
Norwalk	CA	107140
Novato	CA	55530
Nubieber	CA	50
Nuevo	CA	6447
Oak Creek	CA	10018
Oak Glen	CA	638
Oak Hills	CA	8879
Oak Park	CA	13811
Oak Run	CA	0
Oak Shores	CA	337
Oak View	CA	4066
Oakdale	CA	22259
Oakhurst	CA	2829
Oakland	CA	419267
Oakley	CA	39813
Oakville	CA	71
Oasis	CA	6890
Occidental	CA	1115
Oceano	CA	7286
Oceanside	CA	175691
Ocotillo	CA	266
Oildale	CA	32684
Ojai	CA	7627
Olancha	CA	192
Old Fig Garden	CA	5365
Old River	CA	0
Old Station	CA	51
Old Stine	CA	0
Olde Stockdale	CA	0
Olivehurst	CA	13656
Ono	CA	0
Ontario	CA	171214
Onyx	CA	475
Orange	CA	140992
Orange Blossom	CA	0
Orange Cove	CA	9598
Orangevale	CA	33960
Orcutt	CA	28905
Ore'q	CA	357
Orick	CA	357
Orinda	CA	19279
Orland	CA	7550
Orosi	CA	8770
Oroville	CA	16260
Oroville East	CA	8280
Oxnard	CA	207254
Pacheco	CA	3685
Pacific Grove	CA	15674
Pacific Palisades	CA	23121
Pacifica	CA	39260
Pajaro	CA	3070
Pajaro Dunes	CA	0
Pala	CA	0
Palermo	CA	5382
Palm Desert	CA	51869
Palm Springs	CA	47371
Palmdale	CA	158351
Palo Alto	CA	66853
Palo Cedro	CA	1269
Palo Verde	CA	171
Paloma	CA	0
Palos Verdes Estates	CA	13682
Panoche	CA	8
Panorama Heights	CA	41
Paradise	CA	26476
Paradise Park	CA	389
Paramount	CA	55412
Parkfield	CA	18
Parklawn	CA	0
Parksdale	CA	2621
Parkside	CA	16874
Parkway	CA	14670
Parkwood	CA	2268
Parlier	CA	15138
Pasadena	CA	142250
Pasatiempo	CA	1041
Paskenta	CA	112
Paso Robles	CA	27157
Patterson	CA	21498
Patterson Tract	CA	1752
Patton	CA	0
Patton Village	CA	702
Paxton	CA	14
Paynes Creek	CA	57
Pearsonville	CA	17
Pedley	CA	12672
Penn Valley	CA	1621
Penngrove	CA	2522
Penryn	CA	831
Pepperdine University	CA	0
Perris	CA	74971
Pescadero	CA	643
Petaluma	CA	60438
Petaluma Center	CA	0
Peters	CA	672
Phelan	CA	14304
Phillipsville	CA	140
Philo	CA	349
Phoenix Lake	CA	4269
PiÃ±on Hills	CA	0
Pico Rivera	CA	64218
Piedmont	CA	11376
Pierpoint	CA	52
Pike	CA	134
Pine Canyon	CA	0
Pine Flat	CA	166
Pine Grove	CA	2219
Pine Hills	CA	3131
Pine Mountain Club	CA	2315
Pine Mountain Lake	CA	0
Pine Valley	CA	1510
Pinole	CA	19269
Piñon Hills	CA	7272
Pioneer	CA	1094
Piru	CA	2063
Pismo Beach	CA	8162
Pittsburg	CA	69424
Pixley	CA	3310
Placentia	CA	52495
Placerville	CA	10650
Plainview	CA	945
Planada	CA	4584
Platina	CA	0
Pleasant Hill	CA	34810
Pleasanton	CA	79510
Pleasure Point	CA	0
Plumas Eureka	CA	339
Plumas Eureka (historical)	CA	339
Plumas Lake	CA	5853
Plymouth	CA	960
Point Arena	CA	453
Point Reyes Station	CA	848
Pollock Pines	CA	6871
Pomona	CA	153266
Ponderosa	CA	16
Poplar-Cotton Center	CA	2470
Port Costa	CA	190
Port Hueneme	CA	22423
Porterville	CA	56058
Portola	CA	1903
Portola Hills	CA	9083
Portola Valley	CA	4594
Posey	CA	10
Poso Park	CA	9
Post Mountain	CA	0
Potomac Park	CA	0
Potrero	CA	656
Potter Valley	CA	646
Poway	CA	50157
Prattville	CA	33
Princeton	CA	303
Proberta	CA	267
Prunedale	CA	17560
Pumpkin Center	CA	0
Quail Hill	CA	7651
Quail Valley	CA	1538
Quartz Hill	CA	10912
Quincy	CA	1728
Rackerby	CA	204
Rail Road Flat	CA	475
Rainbow	CA	1832
Raisin	CA	0
Raisin City	CA	380
Ramona	CA	20292
Rancho Calaveras	CA	4489
Rancho Cordova	CA	71017
Rancho Cucamonga	CA	175236
Rancho Mirage	CA	18083
Rancho Mission Viejo	CA	0
Rancho Murieta	CA	5488
Rancho Palos Verdes	CA	42732
Rancho Penasquitos	CA	60000
Rancho San Diego	CA	21208
Rancho Santa Fe	CA	3117
Rancho Santa Margarita	CA	49324
Rancho Tehama Reserve	CA	1485
Randsburg	CA	69
Red Bluff	CA	14131
Red Corral	CA	1413
Redcrest	CA	89
Redding	CA	91582
Redlands	CA	71035
Redondo Beach	CA	68166
Redway	CA	1225
Redwood	CA	0
Redwood City	CA	85288
Redwood Shores	CA	10500
Redwood Valley	CA	1729
Reedley	CA	25569
Reliez Valley	CA	0
Reseda	CA	65000
Rexland Acres	CA	0
Rialto	CA	103132
Richfield	CA	306
Richgrove	CA	2882
Richmond	CA	109708
Richvale	CA	244
Ridgecrest	CA	28780
Ridgecrest Heights	CA	0
Ridgemark	CA	3016
Rio Del Mar	CA	9216
Rio Dell	CA	3387
Rio Linda	CA	15106
Rio Oso	CA	356
Rio Vista	CA	8348
Ripley	CA	692
Ripon	CA	15151
River Pines	CA	379
Riverbank	CA	24122
Riverdale	CA	3153
Riverdale Park	CA	1128
Rivergrove	CA	0
Riverside	CA	317261
Robbins	CA	323
Robinson Mill	CA	0
Rocklin	CA	61213
Rodeo	CA	8679
Rodriguez Camp	CA	156
Rohnert Park	CA	42407
Rolling Hills	CA	1893
Rolling Hills Estates	CA	8258
Rollingwood	CA	2969
Romoland	CA	1684
Rosamond	CA	18150
Rose Hills	CA	0
Rosedale	CA	14058
Roseland	CA	6325
Rosemead	CA	54908
Rosemont	CA	22681
Roseville	CA	130269
Ross	CA	2479
Rossmoor	CA	10244
Rough and Ready	CA	963
Round Mountain	CA	155
Round Valley	CA	435
Rouse	CA	0
Rowland Heights	CA	48993
Rubidoux	CA	34280
Rumsey	CA	0
Running Springs	CA	4862
Ruth	CA	195
Rutherford	CA	164
Sacramento	CA	524943
Sage	CA	0
Saint Helena	CA	5814
Salida	CA	13722
Salinas	CA	157380
Salmon Creek	CA	86
Salton	CA	0
Salton City	CA	3763
Salton Sea Beach	CA	422
Salyer	CA	0
Samoa	CA	258
San Andreas	CA	2783
San Anselmo	CA	12653
San Antonio Heights	CA	3371
San Ardo	CA	517
San Bernardino	CA	216108
San Bruno	CA	43185
San Buenaventura (Ventura)	CA	0
San Carlos	CA	29931
San Clemente	CA	65526
San Diego	CA	1404452
San Diego Country Estates	CA	10109
San Dimas	CA	34630
San Fernando	CA	24931
San Francisco	CA	827526
San Gabriel	CA	40424
San Geronimo	CA	446
San Jacinto	CA	46951
San Joaquin	CA	4022
San Joaquin Hills	CA	3176
San Jose	CA	997368
San Juan Bautista	CA	1961
San Juan Capistrano	CA	36454
San Leandro	CA	90712
San Lorenzo	CA	23452
San Lucas	CA	269
San Luis Obispo	CA	47339
San Marcos	CA	92931
San Marino	CA	13464
San Martin	CA	7027
San Mateo	CA	103536
San Miguel	CA	2336
San Pablo	CA	30407
San Pasqual	CA	2041
San Pedro	CA	83556
San Rafael	CA	59162
San Ramon	CA	76134
San Simeon	CA	462
Sand	CA	0
Sand City	CA	381
Sanger	CA	24950
Santa Ana	CA	310227
Santa Barbara	CA	91842
Santa Clara	CA	126215
Santa Clarita	CA	182371
Santa Cruz	CA	64220
Santa Fe Springs	CA	18026
Santa Margarita	CA	1259
Santa Maria	CA	105093
Santa Monica	CA	93220
Santa Nella	CA	0
Santa Paula	CA	30546
Santa Rosa	CA	178127
Santa Rosa Valley	CA	0
Santa Susana	CA	1037
Santa Venetia	CA	4292
Santa Ynez	CA	4418
Santee	CA	57787
Saranap	CA	5202
Saratoga	CA	30968
Saticoy	CA	1029
Sattley	CA	49
Sausalito	CA	7156
Sawtelle	CA	39757
Scotia	CA	850
Scotts Valley	CA	11945
Sea Ranch	CA	1305
Seacliff	CA	3267
Seal Beach	CA	24619
Searles Valley	CA	1739
Seaside	CA	33025
Sebastopol	CA	7678
Sedco Hills	CA	3158
Seeley	CA	1739
Selma	CA	24414
Sequoia Crest	CA	10
Sereno Del Mar	CA	126
Seven Trees	CA	1788
Seville	CA	480
Shackelford	CA	3371
Shadow Hills	CA	13000
Shafter	CA	18336
Shandon	CA	1295
Shasta	CA	1771
Shasta Lake	CA	10159
Shaver Lake	CA	634
Sheep Ranch	CA	0
Shell Ridge	CA	0
Shelter Cove	CA	693
Sheridan	CA	1238
Sherman Oaks	CA	52677
Shingle Springs	CA	4432
Shingletown	CA	2283
Shoshone	CA	31
Sierra	CA	0
Sierra Brooks	CA	478
Sierra City	CA	221
Sierra Madre	CA	11163
Sierra Village	CA	456
Sierraville	CA	200
Signal Hill	CA	11565
Silver	CA	0
Silver Lake	CA	32890
Silver Lakes	CA	5623
Silverado	CA	0
Silverado Resort	CA	0
Simi Valley	CA	126788
Sisquoc	CA	183
Sky Valley	CA	2406
Sleepy Hollow	CA	2384
Smartsville	CA	177
Smith Corner	CA	524
Smith River	CA	866
Snelling	CA	231
Soda Bay	CA	1016
Soda Springs	CA	81
Solana Beach	CA	13449
Soledad	CA	25003
Solvang	CA	5741
Somerset	CA	3642
Somis	CA	0
Sonoma	CA	11037
Sonoma State University	CA	0
Sonora	CA	4818
Soquel	CA	9644
Sorrento Valley	CA	5000
Soulsbyville	CA	2215
South Dos Palos	CA	1620
South El Monte	CA	20878
South Gate	CA	96401
South Lake Tahoe	CA	21706
South Monrovia Island	CA	0
South Oroville	CA	5742
South Pasadena	CA	26151
South San Francisco	CA	67271
South San Gabriel	CA	8070
South San Jose Hills	CA	20551
South Taft	CA	2169
South Whittier	CA	57156
South Yuba City	CA	15217
Spaulding	CA	0
Spreckels	CA	673
Spring Garden	CA	16
Spring Valley	CA	28205
Spring Valley Lake	CA	8220
Springville	CA	934
Squaw Valley	CA	0
Squirrel Mountain Valley	CA	547
St. Helena	CA	0
Stallion Springs	CA	2488
Stanford	CA	13809
Stanton	CA	38872
Stebbins	CA	0
Stevenson Ranch	CA	17557
Stevinson	CA	313
Stinson Beach	CA	632
Stirling	CA	0
Stirling City	CA	295
Stockton	CA	305658
Stonegate	CA	18938
Stones Landing	CA	0
Stonyford	CA	149
Storrie	CA	4
Stratford	CA	1277
Strathmore	CA	2819
Strawberry	CA	5393
Studio City	CA	34034
Sugarloaf	CA	0
Sugarloaf Saw Mill	CA	18
Sugarloaf Village	CA	10
Suisun	CA	28111
Sultana	CA	775
Summerland	CA	1448
Sun	CA	0
Sun City	CA	19579
Sun Village	CA	11565
Sunland	CA	15316
Sunny Slopes	CA	182
Sunnyside	CA	4235
Sunnyside-Tahoe	CA	0
Sunnyside-Tahoe City	CA	1557
Sunnyslope	CA	5153
Sunnyvale	CA	155805
Sunol	CA	913
Sunset Beach	CA	971
Susanville	CA	15247
Sutter	CA	2904
Sutter Creek	CA	2488
Swall Meadows	CA	220
Sylmar	CA	79614
Taft	CA	9495
Taft Heights	CA	1949
Taft Mosswood	CA	1530
Tahoe Vista	CA	1433
Tahoma	CA	1191
Talmage	CA	1130
Tamalpais Valley	CA	7000
Tamalpais-Homestead Valley	CA	10735
Tancred	CA	0
Tara Hills	CA	5126
Tarina	CA	0
Tarpey	CA	0
Tarpey Village	CA	3888
Taylorsville	CA	140
Tecopa	CA	150
Tehachapi	CA	13021
Tehama	CA	416
Temecula	CA	110003
Temelec	CA	1441
Temescal Valley	CA	0
Temple	CA	0
Temple City	CA	36365
Templeton	CA	7674
Tennant	CA	41
Terminous	CA	381
Terra Bella	CA	3310
Teviston	CA	1214
Thermal	CA	2865
Thermalito	CA	6646
Thornton	CA	1131
Thousand Oaks	CA	129339
Thousand Palms	CA	7715
Three Rivers	CA	2182
Three Rocks	CA	246
Tiburon	CA	9214
Tierra Buena	CA	5797
Timber Cove	CA	0
Tipton	CA	2543
Tobin	CA	12
Tomales	CA	204
Tonyville	CA	316
Tooleville	CA	339
Topanga	CA	8289
Topaz	CA	50
Toro Canyon	CA	1508
Torrance	CA	143592
Trabuco Canyon	CA	3000
Tracy	CA	87075
Tranquillity	CA	799
Traver	CA	713
Tres Pinos	CA	476
Trinidad	CA	357
Trinity	CA	0
Trinity Center	CA	267
Trinity Village	CA	297
Trona	CA	0
Trowbridge	CA	226
Truckee	CA	16299
Tujunga	CA	26527
Tulare	CA	62315
Tulelake	CA	994
Tuolumne	CA	0
Tuolumne City	CA	1779
Tupman	CA	161
Turlock	CA	72292
Turtle Rock	CA	12288
Tustin	CA	80583
Tustin Legacy	CA	21428
Tuttle	CA	103
Tuttletown	CA	668
Twain	CA	82
Twain Harte	CA	2226
Twentynine Palms	CA	26025
Twin Bridges	CA	23
Twin Lakes	CA	4917
UC Irvine	CA	15807
Ukiah	CA	15917
Union	CA	0
Union City	CA	74494
Universal City	CA	105000
University of California-Davis	CA	0
University of California-Merced	CA	0
University of California-Santa Barbara	CA	0
University Park	CA	7885
University Research Park	CA	976
University Town Center	CA	6455
Upland	CA	76443
Upper Lake	CA	1052
Vacaville	CA	96803
Val Verde	CA	2468
Valencia	CA	148456
Valinda	CA	22822
Valle Vista	CA	14578
Vallecito	CA	442
Vallejo	CA	121692
Valley Acres	CA	527
Valley Center	CA	9277
Valley Ford	CA	147
Valley Glen	CA	60000
Valley Home	CA	228
Valley Ranch	CA	109
Valley Springs	CA	3553
Valley Wells	CA	0
Van Nuys	CA	136443
Vandenberg	CA	0
Vandenberg AFB	CA	0
Vandenberg Space Force Base	CA	3338
Vandenberg Village	CA	6497
Venice	CA	40885
Ventura	CA	96769
Verdi	CA	162
Vermont Square	CA	47555
Vernon	CA	114
Victor	CA	293
Victorville	CA	122225
View Park-Windsor Hills	CA	11075
Villa Park	CA	5964
Vina	CA	237
Vincent	CA	15922
Vine Hill	CA	3761
Vineyard	CA	24836
Virginia Lakes	CA	0
Visalia	CA	130104
Visitacion Valley	CA	22534
Vista	CA	100890
Vista Santa Rosa	CA	2926
Volcano	CA	115
Volta	CA	246
Waldon	CA	5364
Walker	CA	721
Wallace	CA	403
Walnut	CA	30237
Walnut Creek	CA	68910
Walnut Grove	CA	1542
Walnut Park	CA	15966
Walnut Village	CA	7675
Warm Springs	CA	0
Warner Valley	CA	0
Wasco	CA	26279
Washington	CA	185
Waterford	CA	8824
Waterloo	CA	572
Watsonville	CA	53628
Waukena	CA	108
Wautec	CA	0
Wawona	CA	169
Weaverville	CA	3600
Weed	CA	2556
Weedpatch	CA	2658
Weitchpec	CA	0
Weldon	CA	2642
Weott	CA	288
West Athens	CA	8729
West Bishop	CA	2607
West Carson	CA	21699
West Covina	CA	108484
West Goshen	CA	0
West Hills	CA	41426
West Hollywood	CA	36222
West Menlo Park	CA	3659
West Modesto	CA	5682
West Park	CA	1157
West Point	CA	674
West Puente Valley	CA	22636
West Rancho Dominguez	CA	5669
West Sacramento	CA	52721
West Whittier-Los Nietos	CA	25540
Westhaven-Moonstone	CA	1205
Westlake	CA	0
Westlake Village	CA	8507
Westley	CA	603
Westminster	CA	92114
Westmont	CA	31853
Westmorland	CA	2267
Westpark	CA	22993
Westside	CA	0
Westwood	CA	2019
Wheatland	CA	3725
Whitehawk	CA	113
Whitewater	CA	0
Whitley Gardens	CA	285
Whitmore	CA	0
Whittier	CA	87438
Wildomar	CA	35632
Wilkerson	CA	563
Williams	CA	5196
Williams Canyon	CA	0
Willits	CA	4861
Willow Creek	CA	1710
Willowbrook	CA	35983
Willows	CA	6069
Wilmington	CA	52000
Wilseyville	CA	0
Wilsonia	CA	5
Wilton	CA	5363
Winchester	CA	2534
Windsor	CA	27464
Winnetka	CA	47000
Winter Gardens	CA	20631
Winterhaven	CA	394
Winters	CA	7034
Winton	CA	10613
Wofford Heights	CA	2200
Woodacre	CA	1348
Woodbridge	CA	24966
Woodcrest	CA	14347
Woodlake	CA	7654
Woodland	CA	58567
Woodland Hills	CA	70000
Woodlands	CA	576
Woodside	CA	5561
Woodville	CA	1740
Woodville Farm Labor Camp	CA	0
Woody	CA	0
Wrightwood	CA	4525
Yankee Hill	CA	333
Yermo	CA	623
Yettem	CA	211
Yokuts Valley	CA	3162
Yolo	CA	450
Yorba Linda	CA	67973
Yosemite Lakes	CA	4952
Yosemite Valley	CA	1035
Yosemite West	CA	0
Yountville	CA	3017
Yreka	CA	7597
Yuba	CA	0
Yuba City	CA	66941
Yucaipa	CA	53328
Yucca Valley	CA	21600
Zayante	CA	705
Zzyzx	CA	1
Acres Green	CO	3007
Aetna Estates	CO	834
Aguilar	CO	476
Air Force Academy	CO	6680
Akron	CO	1724
Alamosa	CO	9819
Alamosa East	CO	1458
Allenspark	CO	528
Alma	CO	277
Alpine	CO	174
Altona	CO	501
Amherst	CO	58
Antonito	CO	759
Applewood	CO	7160
Arapahoe	CO	0
Arboles	CO	280
Aristocrat Ranchettes	CO	1344
Arriba	CO	196
Arvada	CO	115368
Aspen	CO	6882
Aspen Park	CO	882
Atwood	CO	133
Ault	CO	1622
Aurora	CO	359407
Avon	CO	6505
Avondale	CO	674
Bailey	CO	8042
Bark Ranch	CO	213
Basalt	CO	3891
Battlement Mesa	CO	4471
Bayfield	CO	2567
Bennett	CO	2484
Berkley	CO	11207
Berthoud	CO	6031
Bethune	CO	239
Beulah Valley	CO	556
Black Forest	CO	13116
Black Hawk	CO	125
Blanca	CO	370
Blende	CO	878
Blue River	CO	904
Blue Sky	CO	24
Blue Valley	CO	0
Bonanza	CO	16
Bonanza Mountain Estates	CO	128
Boone	CO	345
Boulder	CO	106803
Bow Mar	CO	945
Brandon	CO	21
Branson	CO	67
Breckenridge	CO	4896
Brick Center	CO	107
Briggsdale	CO	0
Brighton	CO	37585
Brook Forest	CO	0
Brookside	CO	246
Broomfield	CO	65065
Brush	CO	5459
Buena Vista	CO	2760
Burlington	CO	3720
Byers	CO	1160
CaÃ±on	CO	0
Calhan	CO	789
Campion	CO	1839
Campo	CO	105
Cañon City	CO	16400
Capulin	CO	200
Carbonate	CO	0
Carbondale	CO	6670
Carriage Club	CO	1090
Cascade-Chipita Park	CO	1655
Castle Pines	CO	3614
Castle Pines North	CO	10360
Castle Rock	CO	55591
Castlewood	CO	25271
Cathedral	CO	14
Catherine	CO	228
Cattle Creek	CO	641
Cedaredge	CO	2183
Centennial	CO	109741
Center	CO	2204
Central	CO	0
Central City	CO	724
Chacra	CO	329
Cheraw	CO	247
Cherry Creek	CO	11120
Cherry Hills	CO	0
Cherry Hills Village	CO	6539
Cheyenne Wells	CO	837
Cimarron Hills	CO	16161
City of Creede	CO	0
Clifton	CO	19889
Coal Creek	CO	2400
Coaldale	CO	255
Cokedale	CO	119
Collbran	CO	702
Colona	CO	30
Colorado	CO	0
Colorado City	CO	2193
Colorado Springs	CO	456568
Columbine	CO	24280
Columbine Valley	CO	1360
Comanche Creek	CO	369
Commerce	CO	0
Commerce City	CO	53696
Conejos	CO	58
Cope	CO	0
Copper Mountain	CO	385
Cortez	CO	8715
Cotopaxi	CO	47
Cottonwood	CO	931
Craig	CO	8844
Crawford	CO	408
Creede	CO	405
Crested Butte	CO	1579
Crestone	CO	139
Cripple Creek	CO	1155
Crisman	CO	186
Crook	CO	110
Crowley	CO	170
Crystal	CO	2
Dacono	CO	4792
Dakota Ridge	CO	33892
De Beque	CO	496
Deer Trail	CO	612
Del Norte	CO	1604
Delta	CO	8791
Denver	CO	729019
Derby	CO	7685
Dillon	CO	961
Dinosaur	CO	311
Divide	CO	127
Dolores	CO	963
Dotsero	CO	705
Dove Creek	CO	697
Dove Valley	CO	5243
Downieville-Lawson-Dumont	CO	594
Durango	CO	18006
Eads	CO	608
Eagle	CO	6678
East Pleasant View	CO	356
Eaton	CO	4928
Echo Hills	CO	0
Eckley	CO	251
Edgewater	CO	5302
Edwards	CO	10266
El Jebel	CO	3801
El Moro	CO	221
Elbert	CO	230
Eldora	CO	142
Eldorado Springs	CO	585
Elizabeth	CO	1402
Ellicott	CO	1131
Empire	CO	287
Englewood	CO	33082
Erie	CO	21420
Estes Park	CO	6257
Evans	CO	21383
Evergreen	CO	9038
Fairmount	CO	0
Fairplay	CO	681
Federal Heights	CO	12381
Firestone	CO	11999
Flagler	CO	558
Fleming	CO	403
Florence	CO	3865
Florissant	CO	104
Floyd Hill	CO	0
Fort Carson	CO	13813
Fort Collins	CO	170924
Fort Garland	CO	433
Fort Lupton	CO	7822
Fort Morgan	CO	11319
Fountain	CO	27767
Four Square Mile	CO	0
Fowler	CO	1148
Foxfield	CO	760
Franktown	CO	395
Fraser	CO	1213
Frederick	CO	11413
Frisco	CO	3035
Fruita	CO	12795
Fruitvale	CO	7675
Fulford	CO	2
Garden	CO	0
Garden City	CO	266
Gardner	CO	0
Garfield	CO	15
Genesee	CO	3609
Genoa	CO	141
Georgetown	CO	1049
Gerrard	CO	278
Gilcrest	CO	1083
Glendale	CO	5198
Gleneagle	CO	6611
Glenwood Springs	CO	9906
Gold Hill	CO	230
Golden	CO	20330
Goldfield	CO	49
Granada	CO	486
Granby	CO	1877
Grand Junction	CO	60358
Grand Lake	CO	483
Grand View Estates	CO	528
Greeley	CO	108795
Green Mountain Falls	CO	656
Greenwood	CO	0
Greenwood Village	CO	15663
Grover	CO	146
Guffey	CO	98
Gunbarrel	CO	9263
Gunnison	CO	6076
Gypsum	CO	6922
Hartman	CO	73
Hartsel	CO	0
Hasty	CO	144
Haswell	CO	69
Haxtun	CO	930
Hayden	CO	1839
Heeney	CO	76
Heritage Hills	CO	716
Hidden Lake	CO	31
Highlands Ranch	CO	96713
Hillrose	CO	250
Hoehne	CO	111
Holly	CO	760
Holly Hills	CO	2521
Holyoke	CO	2251
Hooper	CO	103
Hot Sulphur Springs	CO	677
Hotchkiss	CO	902
Howard	CO	723
Hudson	CO	1571
Hugo	CO	736
Idaho Springs	CO	1728
Idalia	CO	88
Idledale	CO	252
Ignacio	CO	720
Iliff	CO	259
Indian Hills	CO	1280
Inverness	CO	1532
Jackson Lake	CO	0
Jamestown	CO	264
Jansen	CO	112
Joes	CO	80
Johnson	CO	0
Johnson Village	CO	246
Johnstown	CO	14896
Julesburg	CO	1237
Keenesburg	CO	1195
Ken Caryl	CO	32438
Keota	CO	5
Kersey	CO	1577
Keystone	CO	1079
Kim	CO	67
Kiowa	CO	748
Kirk	CO	59
Kit Carson	CO	229
Kittredge	CO	1304
Kremmling	CO	1457
La Jara	CO	801
La Junta	CO	6951
La Junta Gardens	CO	153
La Salle	CO	2052
La Veta	CO	759
Lafayette	CO	27729
Laird	CO	47
Lake	CO	0
Lake City	CO	367
Lakeside	CO	8
Lakewood	CO	152597
Lamar	CO	7555
Laporte	CO	2450
Larkspur	CO	194
Las Animas	CO	2227
Lazear	CO	0
Lazy Acres	CO	920
Leadville	CO	2644
Leadville North	CO	1794
Lewis	CO	302
Leyner	CO	29
Limon	CO	1911
Lincoln Park	CO	3546
Littleton	CO	46368
Lochbuie	CO	5390
Log Lane	CO	0
Log Lane Village	CO	873
Loghill	CO	0
Loghill Village	CO	521
Loma	CO	1293
Lone Tree	CO	13175
Longmont	CO	92088
Louisville	CO	20396
Louviers	CO	269
Loveland	CO	75182
Lynn	CO	12
Lyons	CO	2147
Manassa	CO	966
Mancos	CO	1380
Manitou Springs	CO	5334
Manzanola	CO	419
Marble	CO	135
Marvel	CO	0
Matheson	CO	0
Maybell	CO	72
Maysville	CO	135
McClave	CO	0
McCoy	CO	24
Mead	CO	4476
Meeker	CO	2362
Meridian	CO	2970
Merino	CO	283
Midland	CO	156
Milliken	CO	6388
Minturn	CO	1026
Moffat	CO	116
Monte Vista	CO	4294
Montezuma	CO	68
Montrose	CO	19062
Monument	CO	6420
Morgan Heights	CO	266
Morrison	CO	434
Mount Crested Butte	CO	801
Mountain	CO	0
Mountain Meadows	CO	274
Mountain View	CO	528
Mountain Village	CO	1395
Mulford	CO	174
Nathrop	CO	288
Naturita	CO	528
Nederland	CO	1520
New Castle	CO	4669
New Raymer	CO	109
Niwot	CO	4006
No Name	CO	123
Norrie	CO	7
North La Junta	CO	512
North Washington	CO	484
Northglenn	CO	39197
Norwood	CO	562
Nucla	CO	702
Nunn	CO	444
Oak Creek	CO	890
Olathe	CO	1798
Olney Springs	CO	326
Ophir	CO	169
Orchard	CO	90
Orchard City	CO	3011
Orchard Mesa	CO	6836
Ordway	CO	1032
Otis	CO	475
Ouray	CO	1008
Ovid	CO	314
Padroni	CO	76
Pagosa Springs	CO	1756
Palisade	CO	2651
Palmer Lake	CO	2590
Paoli	CO	33
Paonia	CO	1405
Parachute	CO	1105
Paragon Estates	CO	928
Park Center	CO	0
Parker	CO	49550
Parshall	CO	47
Peetz	CO	237
Penrose	CO	3582
Peoria	CO	163
Perry Park	CO	1646
Peyton	CO	250
Phippsburg	CO	204
Piedra	CO	0
Pierce	CO	873
Pine Brook Hill	CO	983
Pine Valley	CO	0
Pitkin	CO	69
Placerville	CO	0
Platteville	CO	2619
Poncha Springs	CO	777
Ponderosa Park	CO	3232
Portland	CO	135
Pritchett	CO	135
Prospect Heights	CO	21
Pueblo	CO	109412
Pueblo West	CO	29637
Ramah	CO	126
Rangely	CO	2381
Raymer	CO	96
Raymer (New Raymer)	CO	0
Red Cliff	CO	274
Red Feather Lakes	CO	343
Redlands	CO	8685
Redstone	CO	130
Redvale	CO	236
Rico	CO	255
Ridgway	CO	977
Rifle	CO	9563
Rock Creek Park	CO	58
Rockvale	CO	498
Rocky Ford	CO	3827
Rollinsville	CO	181
Romeo	CO	387
Roxborough Park	CO	9099
Rye	CO	156
Saddle Ridge	CO	56
Saguache	CO	480
Saint Anton Highlands	CO	288
Saint Marys	CO	283
Salida	CO	5467
Salt Creek	CO	587
San Acacio	CO	40
San Luis	CO	618
Sanford	CO	852
Sawpit	CO	40
Security-Widefield	CO	32882
Sedalia	CO	206
Sedgwick	CO	148
Segundo	CO	98
Seibert	CO	220
Sequndo	CO	121
Seven Hills	CO	121
Severance	CO	3697
Shaw Heights	CO	5116
Sheridan	CO	6039
Sheridan Lake	CO	89
Sherrelwood	CO	18287
Sierra Ridge	CO	0
Silt	CO	3043
Silver Cliff	CO	591
Silver Plume	CO	174
Silverthorne	CO	4418
Silverton	CO	637
Simla	CO	632
Smeltertown	CO	120
Snowmass	CO	0
Snowmass Village	CO	2916
Snyder	CO	132
Somerset	CO	0
South Fork	CO	362
Southern Ute	CO	0
Southglenn	CO	42268
Springfield	CO	1396
St. Ann Highlands	CO	0
St. Mary's	CO	0
Starkville	CO	53
Steamboat Springs	CO	12435
Stepping Stone	CO	0
Sterling	CO	14104
Sterling Ranch	CO	0
Stonegate	CO	8962
Stonewall Gap	CO	67
Strasburg	CO	2447
Stratmoor	CO	6900
Stratton	CO	659
Sugar	CO	0
Sugar City	CO	248
Sugarloaf	CO	261
Sunshine	CO	230
Superior	CO	12980
Swink	CO	594
Tabernash	CO	417
Tall Timber	CO	208
Telluride	CO	2399
The Pinery	CO	10517
Thornton	CO	133451
Timnath	CO	625
Todd Creek	CO	3768
Towaoc	CO	1087
Towner	CO	22
Trail Side	CO	59
Trinidad	CO	8153
Twin Lakes	CO	6101
Two Buttes	CO	41
Upper Bear Creek	CO	1059
Upper Witter Gulch	CO	0
Vail	CO	5461
Valdez	CO	47
Valmont	CO	59
Vernon	CO	29
Victor	CO	389
Vilas	CO	110
Vineland	CO	251
Vona	CO	107
Walden	CO	584
Walsenburg	CO	2898
Walsh	CO	518
Ward	CO	155
Watkins	CO	0
Welby	CO	14846
Weldona	CO	139
Wellington	CO	7807
West Pleasant View	CO	3840
Westcliffe	CO	577
Westcreek	CO	129
Westminster	CO	116317
Weston	CO	55
Wheat Ridge	CO	31192
Wiggins	CO	893
Wiley	CO	385
Williamsburg	CO	656
Windsor	CO	32716
Winter Park	CO	993
Wolcott	CO	15
Woodland Park	CO	7222
Woodmoor	CO	8741
Woody Creek	CO	263
Wray	CO	2378
Yampa	CO	436
Yuma	CO	3596
Ansonia	CT	18854
Avon	CT	18932
Ball Pond	CT	0
Baltic	CT	1250
Bantam	CT	735
Barkhamsted	CT	3647
Bethel	CT	9549
Bethlehem	CT	0
Bethlehem Village	CT	2021
Bigelow Corners	CT	0
Bloomfield	CT	21535
Blue Hills	CT	2901
Bogus Hill	CT	0
Botsford	CT	0
Branchville	CT	0
Branford	CT	29438
Branford Center	CT	5819
Bridgeport	CT	147629
Bridgewater	CT	0
Bristol	CT	60452
Broad Brook	CT	0
Brookfield Center	CT	0
Brooklyn	CT	981
Byram	CT	4146
Canaan	CT	1212
Candlewood Isle	CT	0
Candlewood Knolls	CT	0
Candlewood Lake Club	CT	0
Candlewood Orchards	CT	0
Candlewood Shores	CT	0
Cannondale	CT	141
Canton Valley	CT	1580
Central Waterford	CT	2887
Cheshire	CT	29443
Cheshire Village	CT	5786
Chester Center	CT	1558
Chimney Point	CT	0
City of Milford (balance)	CT	51271
Clinton	CT	3368
Colchester	CT	4781
Coleytown	CT	0
Collinsville	CT	3746
Compo	CT	0
Conning Towers-Nautilus Park	CT	8834
Cornwall	CT	0
Cornwall Bridge	CT	0
Cos Cob	CT	6770
Coventry Lake	CT	2990
Cromwell	CT	13750
Crystal Lake	CT	1945
Danbury	CT	84657
Daniels Farm	CT	0
Danielson	CT	3987
Darien	CT	20732
Darien Downtown	CT	0
Dayville	CT	0
Deep River Center	CT	2484
Derby	CT	12700
Dodgingtown	CT	0
Durham	CT	2933
East	CT	0
East Brooklyn	CT	1638
East Haddam	CT	9042
East Hampton	CT	2691
East Hartford	CT	51252
East Haven	CT	29257
East Norwalk	CT	84530
East Windsor	CT	4069
Easton	CT	7625
Ellington	CT	14693
Enfield	CT	45212
Essex	CT	0
Essex Village	CT	2495
Fairfield	CT	59052
Fairfield University	CT	0
Falls	CT	0
Falls Village	CT	538
Farmington	CT	25000
Fenwick	CT	43
Gales Ferry	CT	1162
Gaylordsville	CT	0
Georgetown	CT	1805
Glastonbury	CT	31876
Glastonbury Center	CT	7387
Glenville	CT	2327
Greens Farms	CT	0
Greenwich	CT	12942
Groton	CT	9221
Groton Long Point	CT	513
Guilford	CT	22498
Guilford Center	CT	2597
Hamden	CT	59847
Hartford	CT	121054
Hawleyville	CT	0
Hazardville	CT	4599
Hebron	CT	9298
Heritage	CT	0
Heritage Village	CT	3736
Higganum	CT	1698
Indian Field	CT	0
Inglenook	CT	0
Jewett	CT	0
Jewett City	CT	3441
Kellogg Point	CT	0
Kensington	CT	8459
Kent	CT	2858
Killingly Center	CT	17282
Killingworth	CT	6174
Knollcrest	CT	0
Lake Bungee	CT	0
Lake Chaffee	CT	0
Lake Pocotopaug	CT	3436
Lakes East	CT	0
Lakes West	CT	0
Lakeside Woods	CT	0
Lakeville	CT	928
Ledyard	CT	15212
Lisbon	CT	4234
Litchfield	CT	1215
Long Hill	CT	4205
Lordship	CT	0
Madison	CT	19100
Madison Center	CT	2290
Mamanasco Lake	CT	0
Manchester	CT	30577
Mansfield Center	CT	947
Mansfield City	CT	26439
Mashantucket	CT	299
Mechanicsville	CT	0
Meriden	CT	59988
Middlebury	CT	6974
Middletown	CT	46756
Milford	CT	52759
Mill Plain	CT	0
Montville Center	CT	20180
Moodus	CT	1413
Moosup	CT	3231
Murray	CT	0
Mystic	CT	4205
Naugatuck	CT	31538
New Britain	CT	72808
New Canaan	CT	19738
New Fairfield	CT	14126
New Hartford Center	CT	1385
New Haven	CT	130322
New London	CT	27179
New Milford	CT	6523
New Preston	CT	1182
Newington	CT	30562
Newtown	CT	1967
Niantic	CT	3114
Noank	CT	1796
Norfolk	CT	553
Noroton	CT	0
Noroton Heights	CT	0
North Branford	CT	14454
North Granby	CT	1944
North Grosvenor Dale	CT	1530
North Haven	CT	24093
North Stamford	CT	121230
Northford	CT	0
Northwest Harwinton	CT	3252
Norwalk	CT	88485
Norwich	CT	39899
Oakville	CT	9047
Old Greenwich	CT	6611
Old Hill	CT	0
Old Mystic	CT	3554
Old Saybrook	CT	10627
Old Saybrook Center	CT	2039
Orange	CT	13956
Oronoque	CT	0
Oxford	CT	11345
Oxoboxo River	CT	3165
Pawcatuck	CT	5624
Pemberwick	CT	3680
Plainfield	CT	15498
Plainfield Village	CT	2557
Plainville	CT	17328
Plantsville	CT	0
Plattsville	CT	0
Pleasant Valley	CT	0
Plymouth	CT	12284
Poplar Plains	CT	0
Poquonock Bridge	CT	1727
Portland	CT	5862
Preston City	CT	5000
Prospect	CT	9476
Putnam	CT	7214
Quasset Lake	CT	0
Quinebaug	CT	1133
Quinnipiac University	CT	0
Redding Center	CT	0
Ridgebury	CT	0
Ridgefield	CT	7645
Riverside	CT	8416
Riverton	CT	0
Rock Ridge	CT	0
Rockville	CT	7474
Route 7 Gateway	CT	0
Sacred Heart University	CT	0
Sail Harbor	CT	0
Salem	CT	4183
Salmon Brook	CT	2324
Sandy Hook	CT	0
Saugatuck	CT	0
Saybrook Manor	CT	1052
Seymour	CT	16562
Sharon	CT	729
Shelton	CT	41296
Sherman	CT	3827
Sherwood Manor	CT	5410
Simsbury Center	CT	5836
Somers	CT	1789
South Coventry	CT	1483
South Wilton	CT	0
South Windham	CT	1421
South Windsor	CT	24412
South Woodstock	CT	1291
Southbury	CT	19836
Southington	CT	43501
Southport	CT	1585
Southwood Acres	CT	7657
Stafford	CT	12029
Stafford Springs	CT	4988
Stamford	CT	128874
Staples	CT	0
Stepney	CT	0
Stonington	CT	908
Storrs	CT	15344
Stratford	CT	51384
Stratford Downtown	CT	0
Suffield Depot	CT	1325
Tariffville	CT	1324
Tashua	CT	0
Taylor Corners	CT	0
Terramuggus	CT	1025
Terryville	CT	5387
Thomaston	CT	1910
Thompson	CT	9358
Thompsonville	CT	8577
Tokeneke	CT	0
Tolland	CT	14891
Topstone	CT	0
Torrington	CT	34906
Trumbull	CT	36018
Trumbull Center	CT	0
Uncasville	CT	1500
Union	CT	797
Wallingford	CT	17712
Wallingford Center	CT	18209
Washington	CT	3466
Waterbury	CT	108802
Waterford	CT	19281
Watertown	CT	3574
Wauregan	CT	1205
Weatogue	CT	2776
West Cornwall	CT	0
West Hartford	CT	63268
West Haven	CT	54927
West Mountain	CT	0
West Simsbury	CT	2447
West Torrington	CT	36000
Westbrook Center	CT	2413
Weston	CT	0
Westport	CT	26391
Wethersfield	CT	26668
Willimantic	CT	17737
Wilton	CT	18062
Wilton Center	CT	0
Winchester Center	CT	10830
Windham	CT	23072
Windsor	CT	28778
Windsor Locks	CT	12498
Winsted	CT	7712
Witches Woods	CT	0
Wolcott	CT	16639
Woodbridge	CT	9355
Woodbury	CT	9755
Woodbury Center	CT	1294
Woodmont	CT	1505
Adams Morgan	DC	15830
Anacostia	DC	11789
Barracks Row	DC	14080
Barry Farms	DC	4129
Bellevue	DC	9643
Benning	DC	8978
Benning Road	DC	10269
Bloomingdale	DC	4980
Brentwood Village	DC	11359
Brightwood	DC	17624
Brookland	DC	8259
Capitol Gateway	DC	7374
Capitol Hill	DC	15056
Capitol Riverfront	DC	18874
Central 14th Street / Spring Road	DC	25899
Central 14th Street / WMATA Northern Bus Barn	DC	11147
Chevy Chase	DC	9545
Cleveland Park	DC	9790
Colorado Triangle	DC	11780
Columbia Heights	DC	38000
Congress Heights	DC	8180
Deanwood	DC	9895
Downtown DC	DC	52560
Dupont Circle	DC	23226
Foggy Bottom	DC	22146
Fort Lincoln	DC	6367
Georgetown	DC	11887
Georgia Avenue / Walter Reed	DC	7996
Glover Park	DC	8124
Golden Triangle	DC	17674
H Street NE	DC	21480
Hillcrest	DC	10205
Ivy City	DC	5264
Kenilworth	DC	7679
Kennedy Street	DC	15251
Lincoln Heights	DC	8858
Mount Pleasant	DC	35842
Mount Vernon Triangle	DC	21897
NoMa	DC	20700
Northwest One	DC	23386
Park View	DC	18796
Pennsylvania Avenue SE	DC	5151
Petworth	DC	18983
Pleasant Plains	DC	21174
Riggs Park	DC	9125
Shaw	DC	17639
Southwest Waterfront	DC	15129
Tenleytown	DC	5684
The Parks At Walter Reed	DC	8252
The Wharf	DC	11274
Union Market	DC	12186
Van Ness	DC	10745
Washington	DC	689545
Woodley Park	DC	9856
Woodridge	DC	6671
Angola by the Bay	DE	311
Arden	DE	450
Ardencroft	DE	231
Ardentown	DE	272
Bear	DE	19371
Bellefonte	DE	1193
Bethany Beach	DE	1170
Bethel	DE	192
Blades	DE	1354
Bowers	DE	0
Bowers Beach	DE	185
Bridgeville	DE	2256
Brookside	DE	14353
Camden	DE	3505
Cheswold	DE	1415
Claymont	DE	8253
Clayton	DE	3123
Dagsboro	DE	859
Delaware	DE	0
Delaware City	DE	1741
Delmar	DE	1730
Dewey Beach	DE	371
Dover	DE	39403
Dover Base Housing	DE	3450
Edgemoor	DE	5677
Ellendale	DE	415
Elsmere	DE	6146
Farmington	DE	117
Felton	DE	1402
Fenwick Island	DE	417
Frankford	DE	933
Frederica	DE	825
Georgetown	DE	7051
Glasgow	DE	14303
Greenville	DE	2326
Greenwood	DE	1066
Harrington	DE	3691
Hartly	DE	71
Henlopen Acres	DE	122
Highland Acres	DE	3459
Hockessin	DE	13527
Houston	DE	391
Kent Acres	DE	1890
Kenton	DE	265
Laurel	DE	4075
Leipsic	DE	196
Lewes	DE	3010
Lincoln	DE	0
Little Creek	DE	233
Long Neck	DE	1980
Magnolia	DE	234
Middletown	DE	20372
Milford	DE	10252
Millsboro	DE	4216
Millville	DE	590
Milton	DE	2824
Nassau	DE	3699
New Castle	DE	5382
Newark	DE	33817
Newport	DE	1058
North Star	DE	7980
Ocean View	DE	2035
Odessa	DE	374
Pike Creek	DE	7898
Pike Creek Valley	DE	11217
Port Penn	DE	0
Rehoboth Beach	DE	1458
Rising Sun-Lebanon	DE	3391
Riverview	DE	2456
Rodney	DE	0
Rodney Village	DE	1487
Seaford	DE	7586
Selbyville	DE	2397
Slaughter Beach	DE	230
Smyrna	DE	11319
South Bethany	DE	497
St. Georges	DE	0
Stephen R Korup / Joseph B Riddle	DE	75
Townsend	DE	2177
Viola	DE	170
Wilmington	DE	70898
Wilmington Manor	DE	7889
Woodside	DE	196
Woodside East	DE	2316
Wyoming	DE	1465
Aberdeen	FL	2672
Acacia Villas	FL	0
Alachua	FL	9757
Alafaya	FL	78113
Alford	FL	467
Allapattah	FL	54289
Allentown	FL	894
Altamonte Springs	FL	43159
Altha	FL	529
Altoona	FL	89
Alturas	FL	4185
Alva	FL	2596
Andover	FL	9877
Andrews	FL	798
Anna Maria	FL	1669
Apalachicola	FL	2281
Apollo Beach	FL	14055
Apopka	FL	48382
Arcadia	FL	7851
Archer	FL	1173
Aripeka	FL	308
Asbury Lake	FL	8700
Astatula	FL	1917
Astor	FL	1556
Atlantic Beach	FL	13193
Atlantis	FL	2106
Auburndale	FL	15035
Aucilla	FL	100
Avalon	FL	0
Ave Maria	FL	6242
Aventura	FL	37649
Avon Park	FL	10086
Azalea Park	FL	12556
Babson Park	FL	1356
Bagdad	FL	3761
Bal Harbour	FL	2877
Baldwin	FL	1453
Balm	FL	1457
Bardmoor	FL	0
Bartow	FL	18972
Bascom	FL	118
Bay Harbor Islands	FL	6036
Bay Hill	FL	4884
Bay Lake	FL	50
Bay Pines	FL	2931
Bayonet Point	FL	23467
Bayport	FL	43
Bayshore Gardens	FL	16323
Beacon Square	FL	7224
Bear Creek	FL	0
Bee Ridge	FL	9598
Bell	FL	464
Bellair-Meadowbrook Terrace	FL	13343
Belle Glade	FL	18251
Belle Glade Camp	FL	1167
Belle Isle	FL	6689
Belleair	FL	3992
Belleair Beach	FL	1609
Belleair Bluffs	FL	2095
Belleair Shore	FL	0
Belleair Shores	FL	109
Belleview	FL	4765
Bellview	FL	23355
Berkshire Lakes	FL	0
Berrydale	FL	441
Beverly Beach	FL	358
Beverly Hills	FL	8445
Big Coppitt Key	FL	2458
Big Pine Key	FL	4252
Biscayne Gardens	FL	0
Biscayne Park	FL	3216
Bithlo	FL	8268
Black Diamond	FL	1101
Black Hammock	FL	0
Bloomingdale	FL	22711
Blountstown	FL	2497
Boca Del Mar	FL	24244
Boca Pointe	FL	4073
Boca Raton	FL	93235
Bokeelia	FL	1780
Bonifay	FL	2726
Bonita Springs	FL	51704
Boulevard Gardens	FL	1274
Bowling Green	FL	2919
Boyette	FL	6518
Boynton Beach	FL	73966
Bradenton	FL	54437
Bradenton Beach	FL	1171
Bradfordville	FL	0
Bradley Junction	FL	686
Brandon	FL	103483
Branford	FL	721
Brent	FL	21804
Brewster (historical)	FL	3
Briny Breezes	FL	603
Bristol	FL	976
Broadview Park	FL	7125
Bronson	FL	1110
Brooker	FL	332
Brookridge	FL	4420
Brooksville	FL	7854
Broward Estates	FL	3777
Brownsdale	FL	471
Brownsville	FL	15313
Buckhead Ridge	FL	1450
Buckingham	FL	4036
Buenaventura Lakes	FL	26079
Bunche Park	FL	4080
Bunnell	FL	2828
Burnt Store Marina	FL	1793
Bushnell	FL	2995
Butler Beach	FL	4951
Cabana Colony	FL	0
Callahan	FL	1185
Callaway	FL	14405
Campbell	FL	2479
Campbellton	FL	221
Canal Point	FL	367
Cantonment	FL	26493
Cape Canaveral	FL	9912
Cape Coral	FL	175229
Capitola	FL	0
Captiva	FL	583
Carol City	FL	63031
Carrabelle	FL	2729
Carrollwood	FL	33365
Carrollwood Village	FL	40949
Carver Ranches	FL	4406
Caryville	FL	280
Casselberry	FL	27056
Cedar Grove	FL	3397
Cedar Key	FL	703
Celebration	FL	7427
Center Hill	FL	1194
Century	FL	1762
Chaires	FL	0
Charleston Park	FL	218
Charlotte Harbor	FL	3714
Charlotte Park	FL	2325
Chattahoochee	FL	3144
Cheval	FL	10702
Chiefland	FL	2218
Chipley	FL	3565
Chokoloskee	FL	359
Christmas	FL	1146
Chuluota	FL	2483
Chumuckla	FL	850
Cinco Bayou	FL	420
Citra	FL	5732
Citrus Hills	FL	7470
Citrus Park	FL	24252
Citrus Ridge	FL	13285
Citrus Springs	FL	8622
Clarcona	FL	2990
Clearwater	FL	117292
Clermont	FL	32390
Cleveland	FL	2990
Clewiston	FL	7505
Cloud Lake	FL	135
Cobbtown	FL	67
Cocoa	FL	17711
Cocoa Beach	FL	11595
Cocoa West	FL	5925
Coconut Creek	FL	59302
Coconut Grove	FL	20076
Coleman	FL	843
Combee Settlement	FL	5577
Connerton	FL	2116
Conway	FL	13467
Cooper	FL	0
Cooper City	FL	35364
Coral Gables	FL	51117
Coral Springs	FL	129485
Coral Terrace	FL	24376
Cortez	FL	4241
Cottondale	FL	900
Country Club	FL	47105
Country Walk	FL	15997
Crawfordville	FL	3702
Crescent	FL	0
Crescent Beach	FL	931
Crescent City	FL	1540
Crestview	FL	23270
Crooked Lake Park	FL	1722
Cross	FL	0
Cross City	FL	1707
Crystal Lake	FL	5514
Crystal River	FL	3089
Crystal Springs	FL	1327
Cudjoe Key	FL	1763
Cutler	FL	18117
Cutler Bay	FL	45425
Cutler Ridge	FL	26831
Cypress Gardens	FL	8917
Cypress Lake	FL	11846
Cypress Quarters	FL	1215
Dade	FL	0
Dade City	FL	6955
Dade City North	FL	3113
Dania Beach	FL	31446
Davenport	FL	3534
Davie	FL	100882
Day	FL	116
Daytona Beach	FL	72647
Daytona Beach Shores	FL	4389
De Land Southwest	FL	1052
De Leon Springs	FL	2614
DeBary	FL	19998
Deerfield Beach	FL	79768
DeFuniak Springs	FL	5795
DeLand	FL	30195
DeLand Southwest	FL	0
Delray Beach	FL	66255
Deltona	FL	88474
Desoto Acres	FL	0
Desoto Lakes	FL	3646
Destin	FL	13523
Dickerson	FL	0
Dickerson City	FL	146
Dixonville	FL	0
Doctor Phillips	FL	10981
Doral	FL	75874
Dover	FL	3702
Duck Key	FL	621
Dundee	FL	4090
Dunedin	FL	36164
Dunes Road	FL	432
Dunnellon	FL	1777
Eagle Lake	FL	2474
East Bronson	FL	1945
East Lake	FL	30962
East Lake-Orient Park	FL	22753
East Milton	FL	11074
East Naples	FL	22951
East Palatka	FL	1654
East Pensacola Heights	FL	54104
East Perrine	FL	7156
East Williston	FL	694
Eastpoint	FL	2337
Eatonville	FL	2271
Ebro	FL	270
Edgewater	FL	21566
Edgewood	FL	2795
Eglin AFB	FL	0
Eglin Air Force Base	FL	2274
Eglin Village	FL	7000
Egypt Lake-Leto	FL	35282
El Portal	FL	2491
Elfers	FL	13986
Ellenton	FL	4275
Eloise	FL	23366
Englewood	FL	14863
Ensley	FL	20602
Estates of Fort Lauderdale (historical)	FL	1791
Estero	FL	30799
Esto	FL	354
Eustis	FL	19986
Everglades	FL	0
Everglades City	FL	379
Fairview Shores	FL	10239
Fanning Springs	FL	985
Feather Sound	FL	3420
Fellsmere	FL	5514
Fern Park	FL	7704
Fernandina Beach	FL	12339
Ferndale	FL	472
Ferry Pass	FL	28921
Fidelis	FL	156
Fish Hawk	FL	14087
Fisher Island	FL	132
Five Points	FL	1265
Flagami	FL	50834
Flagler Beach	FL	4869
Flagler Estates	FL	3215
Fleming Island	FL	27126
Floral	FL	0
Floral City	FL	5217
Florida	FL	0
Florida City	FL	13085
Florida Gulf Coast University	FL	0
Florida Ridge	FL	18164
Floridatown	FL	244
Forest	FL	0
Forest City	FL	13854
Fort Braden	FL	0
Fort Denaud	FL	0
Fort Green	FL	101
Fort Green Springs	FL	231
Fort Lauderdale	FL	183146
Fort Meade	FL	5975
Fort Myers	FL	74013
Fort Myers Beach	FL	6983
Fort Myers Shores	FL	5487
Fort Pierce	FL	44484
Fort Pierce North	FL	6474
Fort Pierce South	FL	5062
Fort Walton Beach	FL	21817
Fort White	FL	566
Fountainebleau	FL	59764
Four Corners	FL	26116
Franklin Park	FL	860
Freeport	FL	2052
Frostproof	FL	3134
Fruit Cove	FL	29362
Fruitland Park	FL	4483
Fruitville	FL	13224
Fuller Heights	FL	8758
Fussels Corner	FL	5561
Gainesville	FL	145214
Gandy	FL	2031
Garcon Point	FL	0
Garden Grove	FL	674
Gardner	FL	463
Gateway	FL	8401
Geneva	FL	2940
Gibsonia	FL	4571
Gibsonton	FL	14234
Gifford	FL	9590
Gladeview	FL	11535
Glen Ridge	FL	234
Glen Saint Mary	FL	437
Glen St. Mary	FL	0
Glencoe	FL	2582
Glenvar Heights	FL	16898
Golden Beach	FL	972
Golden Gate	FL	23961
Golden Glades	FL	33145
Goldenrod	FL	12039
Golf	FL	252
Golfview	FL	163
Gonzalez	FL	13273
Goodland	FL	267
Gotha	FL	1915
Goulding	FL	4102
Goulds	FL	11446
Graceville	FL	2222
Grand Ridge	FL	872
Grant-Valkaria	FL	4056
Greater Northdale	FL	22079
Green Cove Springs	FL	7277
Greenacres	FL	0
Greenacres City	FL	32963
Greenbriar	FL	2502
Greensboro	FL	605
Greenville	FL	803
Greenwood	FL	657
Grenelefe	FL	0
Gretna	FL	1386
Grove	FL	0
Grove City	FL	1804
Groveland	FL	11528
Gulf Breeze	FL	6323
Gulf Gate	FL	0
Gulf Gate Estates	FL	10911
Gulf Stream	FL	836
Gulfport	FL	12322
Gun Club Estates	FL	776
Haines	FL	0
Haines City	FL	22807
Hallandale Beach	FL	39488
Hampton	FL	488
Harbor Bluffs	FL	2860
Harbour Heights	FL	2987
Harlem	FL	2658
Harlem Heights	FL	1975
Harold	FL	823
Hastings	FL	632
Havana	FL	1688
Haverhill	FL	2025
Hawthorne	FL	1492
Heathrow	FL	5896
Heritage Bay	FL	0
Heritage Pines	FL	2136
Hernando	FL	9054
Hernando Beach	FL	2299
Hialeah	FL	237069
Hialeah Gardens	FL	23926
High Point	FL	3686
High Springs	FL	5831
Highland	FL	0
Highland Beach	FL	3729
Highland City	FL	10834
Highland Park	FL	249
Hiland Park	FL	1105
Hill 'n Dale	FL	1934
Hillcrest Heights	FL	254
Hilliard	FL	3154
Hillsboro Beach	FL	2004
Hillsboro Pines	FL	446
Hobe Sound	FL	11521
Holden Heights	FL	3679
Holden Lakes	FL	0
Holiday	FL	22403
Holley	FL	1630
Holly Hill	FL	11943
Hollywood	FL	149728
Holmes Beach	FL	4199
Homeland	FL	366
Homestead	FL	80737
Homestead Base	FL	964
Homosassa	FL	2578
Homosassa Springs	FL	13791
Horizon West	FL	14000
Horseshoe Beach	FL	168
Hosford	FL	650
Howey-in-the-Hills	FL	1098
Hudson	FL	12158
Hunters Creek	FL	14321
Hurlburt Field	FL	0
Hutchinson Island South	FL	5201
Hypoluxo	FL	2719
Immokalee	FL	24154
Indialantic	FL	2837
Indian Creek	FL	0
Indian Creek Village	FL	33
Indian Harbour Beach	FL	8471
Indian Lake Estates	FL	0
Indian River Estates	FL	6220
Indian River Shores	FL	4156
Indian Rocks Beach	FL	4113
Indian Shores	FL	1470
Indiantown	FL	6083
Inglis	FL	1311
Interlachen	FL	1355
Inverness	FL	7233
Inverness Highlands North	FL	2401
Inverness Highlands South	FL	6542
Inwood	FL	6403
Iona	FL	15369
Islamorada	FL	7131
Islamorada, Village of Islands	FL	0
Island Walk	FL	3035
Islandia	FL	18
Isle of Normandy	FL	8841
Istachatta	FL	116
Ives Estates	FL	19525
Jacksonville	FL	1009833
Jacksonville Beach	FL	23064
Jacob	FL	0
Jacob City	FL	244
Jacobs	FL	239
Jan Phyl	FL	0
Jan-Phyl Village	FL	5573
Jasmine Estates	FL	18989
Jasper	FL	4155
Jay	FL	578
Jennings	FL	870
Jensen Beach	FL	11707
June Park	FL	4094
Juno Beach	FL	3474
Juno Ridge	FL	718
Jupiter	FL	62707
Jupiter Farms	FL	0
Jupiter Inlet Beach Colony	FL	368
Jupiter Inlet Colony	FL	0
Jupiter Island	FL	887
Kathleen	FL	6332
Kendale Lakes	FL	56148
Kendall	FL	80241
Kendall Green	FL	3048
Kendall West	FL	36154
Kenneth	FL	0
Kenneth City	FL	5072
Kensington Park	FL	3901
Kenwood Estates	FL	0
Key Biscayne	FL	12990
Key Colony Beach	FL	851
Key Largo	FL	10433
Key Vista	FL	1757
Key West	FL	25755
Keystone	FL	24039
Keystone Heights	FL	1433
Kings Point	FL	12201
Kissimmee	FL	69152
La Crosse	FL	378
LaBelle	FL	4753
Lacoochee	FL	1714
Lady Lake	FL	14717
Laguna Beach	FL	3932
Lake	FL	0
Lake Alfred	FL	5475
Lake Belvedere Estates	FL	3334
Lake Buena Vista	FL	10
Lake Butler	FL	15400
Lake City	FL	12161
Lake Clarke Shores	FL	3552
Lake Forest	FL	5522
Lake Hamilton	FL	1346
Lake Harbor	FL	45
Lake Hart	FL	542
Lake Helen	FL	2687
Lake Kathryn	FL	920
Lake Kerr	FL	0
Lake Lindsey	FL	71
Lake Lindsey Village	FL	71
Lake Lorraine	FL	7010
Lake Lucerne	FL	9044
Lake Mack-Forest Hills	FL	1010
Lake Magdalene	FL	28509
Lake Mary	FL	16021
Lake Mary Jane	FL	0
Lake Mystic	FL	0
Lake Panasoffkee	FL	3551
Lake Park	FL	8538
Lake Placid	FL	2164
Lake Sarasota	FL	4679
Lake Wales	FL	15541
Lake Worth Beach	FL	37498
Lake Worth Corridor	FL	20635
Lakeland	FL	104401
Lakeland Highlands	FL	11056
Lakes by the Bay	FL	11422
Lakeside	FL	30943
Lakewood Park	FL	11323
Lakewood Ranch	FL	0
Lamont	FL	178
Land O' Lakes	FL	31996
Lantana	FL	11136
Largo	FL	81000
Lauderdale Lakes	FL	34796
Lauderdale-by-the-Sea	FL	6460
Lauderhill	FL	71579
Laurel	FL	8171
Laurel Hill	FL	582
Lawtey	FL	719
Layton	FL	190
Lazy Lake	FL	26
Lealman	FL	19879
Lecanto	FL	5882
Lee	FL	331
Leesburg	FL	21993
Lehigh Acres	FL	86784
Leisure	FL	0
Leisure City	FL	26324
Lely	FL	3451
Lely Resort	FL	4646
Lemon Grove	FL	657
Liberty Triangle	FL	0
Lighthouse Point	FL	11104
Limestone	FL	132
Limestone Creek	FL	1014
Lisbon	FL	260
Little Havana	FL	53430
Live Oak	FL	6931
Lloyd	FL	215
Lochmoor Waterway Estates	FL	4204
Lockhart	FL	13060
Longboat Key	FL	7266
Longwood	FL	14085
Loughman	FL	2680
Lower Grand Lagoon	FL	3881
Loxahatchee Groves	FL	3397
Lutz	FL	19344
Lynn Haven	FL	20156
Macclenny	FL	6487
Madeira Beach	FL	4380
Madison	FL	2880
Maitland	FL	17463
Malabar	FL	2936
Malone	FL	2145
Manalapan	FL	449
Manasota Key	FL	1229
Manatee Road	FL	2244
Mango	FL	11313
Mangonia Park	FL	1979
Marathon	FL	8750
Marco	FL	14879
Marco Island	FL	17690
Marco Shores-Hammock Bay	FL	0
Margate	FL	57234
Marianna	FL	9100
Marineland	FL	17
Marion Oaks	FL	19034
Mary Esther	FL	4238
Masaryktown	FL	1040
Mascotte	FL	5473
Matlacha	FL	677
Matlacha Isles-Matlacha Shores	FL	229
Mayo	FL	1237
McGregor	FL	7406
McIntosh	FL	461
Meadow Oaks	FL	2442
Meadow Woods	FL	25558
Medley	FL	851
Medulla	FL	8892
Melbourne	FL	84678
Melbourne Beach	FL	3219
Melbourne Village	FL	691
Melrose Park	FL	7492
Memphis	FL	7848
Merritt Island	FL	34743
Mexico Beach	FL	1167
Miami	FL	487014
Miami Beach	FL	92312
Miami Gardens	FL	113187
Miami Lakes	FL	30972
Miami Shores	FL	10831
Miami Springs	FL	14490
Micanopy	FL	630
Micco	FL	9052
Miccosukee	FL	0
Middleburg	FL	13008
Midway	FL	16115
Milton	FL	9628
Mims	FL	7058
Minneola	FL	10735
Miramar	FL	137132
Miramar Beach	FL	6146
Molino	FL	1277
Monticello	FL	2411
Montura	FL	3343
Montverde	FL	1607
Moon Lake	FL	0
Moore Haven	FL	1794
Morriston	FL	164
Mount Carmel	FL	227
Mount Dora	FL	13519
Mount Plymouth	FL	4011
Mulat	FL	259
Mulberry	FL	3976
Munson	FL	372
Myrtle Grove	FL	15870
Naples	FL	21512
Naples Manor	FL	5562
Naples Park	FL	5967
Naranja	FL	13509
Nassau Village-Ratliff	FL	5337
Navarre	FL	31378
Navarre Beach	FL	0
Neptune Beach	FL	7269
New Port Richey	FL	15842
New Port Richey East	FL	10036
New Smyrna Beach	FL	24298
Newberry	FL	5564
Niceville	FL	14714
Nobleton	FL	282
Nocatee	FL	4524
Nokomis	FL	3167
Noma	FL	205
Norland	FL	23604
North Andrews Gardens	FL	10056
North Bay	FL	0
North Bay Village	FL	8302
North Beach	FL	269
North Brooksville	FL	3544
North DeLand	FL	1450
North Fort Myers	FL	39407
North Key Largo	FL	1244
North Lauderdale	FL	43703
North Merritt Island	FL	0
North Miami	FL	62435
North Miami Beach	FL	43971
North Palm Beach	FL	12015
North Port	FL	62345
North Redington Beach	FL	1463
North River Shores	FL	3079
North Sarasota	FL	6982
North Weeki Wachee	FL	8524
Northdale	FL	22079
Oak Hill	FL	1846
Oak Ridge	FL	22685
Oakland	FL	2829
Oakland Park	FL	44319
Oakleaf	FL	0
Oakleaf Plantation	FL	20315
Ocala	FL	58218
Ocala Estates	FL	0
Ocean	FL	0
Ocean Breeze	FL	0
Ocean Breeze Park	FL	355
Ocean City	FL	5550
Ocean Ridge	FL	1904
Ocklawaha	FL	0
Ocoee	FL	43608
Odessa	FL	7267
Ojus	FL	18036
Okahumpka	FL	267
Okeechobee	FL	5608
Old Miakka	FL	0
Oldsmar	FL	14170
Olga	FL	1952
Olympia Heights	FL	13488
On Top of the World	FL	12668
Ona	FL	314
Opa-locka	FL	16565
Orange	FL	0
Orange City	FL	11210
Orange Park	FL	8702
Orangetree	FL	4406
Orchid	FL	439
Oriole Beach	FL	1420
Orlando	FL	334854
Orlovista	FL	6123
Ormond Beach	FL	40970
Ormond-by-the-Sea	FL	7406
Osprey	FL	6100
Otter Creek	FL	134
Oviedo	FL	38551
Pace	FL	20039
Page Park	FL	514
Pahokee	FL	6071
Paisley	FL	818
Palatka	FL	10390
Palm	FL	0
Palm Aire	FL	1702
Palm Bay	FL	119760
Palm Beach	FL	8612
Palm Beach Gardens	FL	52923
Palm Beach Shores	FL	1208
Palm City	FL	23120
Palm Coast	FL	82893
Palm Harbor	FL	57439
Palm River-Clair Mel	FL	21024
Palm Shores	FL	900
Palm Springs	FL	22341
Palm Springs North	FL	5253
Palm Valley	FL	20019
Palmer Ranch	FL	0
Palmetto	FL	13249
Palmetto Bay	FL	24439
Palmetto Estates	FL	13498
Palmona Park	FL	1146
Panacea	FL	816
Panama	FL	0
Panama City	FL	38286
Panama City Beach	FL	12624
Paradise Heights	FL	1215
Parker	FL	4603
Parkland	FL	30177
Pasadena Hills	FL	7570
Patrick AFB	FL	0
Paxton	FL	749
Pea Ridge	FL	0
Pebble Creek	FL	7622
Pelican Bay	FL	6346
Pelican Marsh	FL	0
Pembroke Park	FL	6333
Pembroke Pines	FL	166611
Penney Farms	FL	815
Pensacola	FL	53724
Pensacola Station	FL	0
Perry	FL	7055
Pierson	FL	1772
Pine Air	FL	0
Pine Castle	FL	10805
Pine Hills	FL	60076
Pine Island	FL	64
Pine Island Center	FL	1854
Pine Island Ridge	FL	5218
Pine Lakes	FL	862
Pine Level	FL	0
Pine Manor	FL	3428
Pine Ridge	FL	9598
Pinecraft	FL	0
Pinecrest	FL	19452
Pineland	FL	407
Pinellas Park	FL	51617
Pinewood	FL	16520
Pioneer	FL	0
Pittman	FL	180
Placid Lakes	FL	3716
Plant	FL	0
Plant City	FL	37406
Plantation	FL	92560
Plantation Island	FL	163
Plantation Mobile Home Park	FL	1260
Poinciana	FL	53193
Point Baker	FL	2991
Polk	FL	0
Polk City	FL	1907
Pomona Park	FL	879
Pompano Beach	FL	107762
Pompano Beach Highlands	FL	7192
Ponce de Leon	FL	549
Ponce Inlet	FL	3157
Ponte Vedra Beach	FL	35400
Port Charlotte	FL	54392
Port LaBelle	FL	3530
Port Orange	FL	59866
Port Richey	FL	2761
Port Saint Joe	FL	3445
Port Saint John	FL	12267
Port Saint Lucie	FL	164603
Port Salerno	FL	10091
Port St. Joe	FL	0
Port St. John	FL	0
Port St. Lucie	FL	0
Pretty Bayou	FL	3206
Princeton	FL	39308
Progress	FL	0
Progress Village	FL	5392
Punta Gorda	FL	18150
Punta Gorda Isles	FL	18306
Punta Rassa	FL	1750
Quail Ridge	FL	1040
Quincy	FL	7830
Raiford	FL	248
Rainbow Lakes Estates	FL	0
Rainbow Park	FL	0
Rainbow Springs	FL	0
Raleigh	FL	373
Reddick	FL	518
Redington Beach	FL	1471
Redington Shores	FL	2205
Richmond Heights	FL	8541
Richmond West	FL	35884
Ridge Manor	FL	4513
Ridge Wood Heights	FL	4795
Ridgecrest	FL	2558
Rio	FL	965
Rio Pinar	FL	0
River Park	FL	5222
River Ridge	FL	0
Riverview	FL	71050
Riviera Beach	FL	34005
Rock Island	FL	3076
Rockledge	FL	24926
Roeville	FL	608
Roosevelt Gardens	FL	2456
Roseland	FL	1472
Rotonda	FL	0
Rotonda West	FL	8759
Royal Palm Beach	FL	37633
Royal Palm Estates	FL	3025
Ruskin	FL	17208
Safety Harbor	FL	17454
Saint Augustine	FL	12975
Saint Augustine Beach	FL	6176
Saint Augustine Shores	FL	7359
Saint Augustine South	FL	4998
Saint Cloud	FL	35183
Saint George	FL	2709
Saint James City	FL	3784
Saint Leo	FL	1340
Saint Lucie	FL	590
Saint Marks	FL	293
Saint Pete Beach	FL	9346
Samoset	FL	3854
Samsula-Spruce Creek	FL	5047
San Antonio	FL	1308
San Carlos Park	FL	16824
San Castle	FL	0
Sandalfoot Cove	FL	16582
Sanford	FL	58111
Sanibel	FL	7236
Santa Rosa Beach	FL	32459
Sarasota	FL	55118
Sarasota Springs	FL	14395
Satellite Beach	FL	10633
Sawgrass	FL	4880
Schall Circle	FL	1117
Scott Lake	FL	14425
Scottsmoor	FL	0
Sea Ranch Lakes	FL	670
Seaside	FL	2000
Sebastian	FL	24007
Sebring	FL	10497
Seffner	FL	7579
Seminole	FL	18153
Seminole Manor	FL	2621
Seville	FL	614
Sewall's Point	FL	2149
Shady Hills	FL	11523
Shalimar	FL	796
Sharpes	FL	3411
Siesta Key	FL	6565
Silver Lake	FL	1879
Silver Springs	FL	10334
Silver Springs Shores	FL	6539
Silver Springs Shores East	FL	0
Sky Lake	FL	6153
Sneads	FL	1776
Solana	FL	742
Sopchoppy	FL	462
Sorrento	FL	861
South Apopka	FL	5728
South Bay	FL	5101
South Beach	FL	3501
South Bradenton	FL	22178
South Brooksville	FL	4007
South Daytona	FL	12584
South Gate Ridge	FL	5688
South Highpoint	FL	5195
South Miami	FL	12242
South Miami Heights	FL	36770
South Palm Beach	FL	1424
South Pasadena	FL	5081
South Patrick Shores	FL	5875
South Sarasota	FL	4950
South Venice	FL	13949
Southchase	FL	15921
Southeast Arcadia	FL	6554
Southgate	FL	7173
Southport	FL	0
Southwest Ranches	FL	7852
Spring Hill	FL	98621
Spring Lake	FL	458
Spring Ridge	FL	0
Springfield	FL	9442
Springhill	FL	0
St. Augustine	FL	0
St. Augustine Beach	FL	0
St. Augustine Shores	FL	0
St. Augustine South	FL	0
St. Cloud	FL	0
St. George Island	FL	0
St. James	FL	0
St. Johns	FL	40000
St. Leo	FL	0
St. Lucie	FL	0
St. Marks	FL	0
St. Pete Beach	FL	0
St. Petersburg	FL	257083
Stacey Street	FL	858
Starke	FL	5397
Steinhatchee	FL	1047
Stock Island	FL	3919
Stuart	FL	16462
Sugarmill Woods	FL	8287
Sumatra	FL	148
Sun City Center	FL	19258
Suncoast Estates	FL	4384
Sunny Isles Beach	FL	22123
Sunrise	FL	84439
Sunset	FL	16389
Sunshine Ranches	FL	1884
Surfside	FL	6024
Sweetwater	FL	20840
Taft	FL	2205
Tallahassee	FL	201731
Tamarac	FL	64681
Tamiami	FL	55271
Tampa	FL	414547
Tangelo Park	FL	2231
Tangerine	FL	2865
Tarpon Springs	FL	24605
Tavares	FL	15430
Tavernier	FL	2136
Taylor Creek	FL	4348
Tedder	FL	2299
Temple Terrace	FL	25731
Tequesta	FL	5629
Terra Mar	FL	2909
The Acreage	FL	38704
The Crossings	FL	22758
The Hammocks	FL	51003
The Meadows	FL	3994
The Villages	FL	51442
Thonotosassa	FL	13014
Three Lakes	FL	15047
Three Oaks	FL	3592
Tice	FL	4470
Tierra Verde	FL	3721
Tiger Point	FL	3090
Tildenville	FL	511
Timber Pines	FL	5386
Titusville	FL	45393
Town 'n' Country	FL	78442
Treasure Island	FL	6887
Trenton	FL	2066
Trilby	FL	419
Trinity	FL	10907
Tropical Park	FL	0
Twin Lakes	FL	2073
Tyndall AFB	FL	0
Tyndall Air Force Base	FL	2994
Umatilla	FL	3702
Union Park	FL	9765
University	FL	41163
University Park	FL	26995
Upper Grand Lagoon	FL	13963
Utopia	FL	732
Valparaiso	FL	5023
Valrico	FL	35545
Vamo	FL	4727
Venice	FL	22211
Venice Gardens	FL	7104
Verandah	FL	0
Vernon	FL	679
Vero Beach	FL	16358
Vero Beach South	FL	23092
Vero Lake Estates	FL	0
Verona Walk	FL	1782
Viera East	FL	10757
Viera West	FL	6641
Vilano Beach	FL	0
Villages of Oriole	FL	4755
Villano Beach	FL	2678
Villas	FL	11569
Vineyards	FL	3375
Virginia Gardens	FL	2487
Wabasso	FL	609
Wabasso Beach	FL	1853
Wacissa	FL	386
Wahneta	FL	5091
Waldo	FL	1030
Wallace	FL	1785
Warm Mineral Springs	FL	5061
Warrington	FL	14531
Washington Park	FL	1672
Watergate	FL	0
Watertown	FL	2829
Wauchula	FL	4935
Waukeenah	FL	272
Wausau	FL	375
Waverly	FL	767
Webster	FL	995
Wedgefield	FL	6705
Weeki Wachee	FL	12
Weeki Wachee Gardens	FL	1146
Wekiwa Springs	FL	21998
Welaka	FL	681
Wellborn	FL	2724
Wellington	FL	62560
Wesley Chapel	FL	44092
West and East Lealman	FL	21924
West Bradenton	FL	4192
West Canaveral Groves	FL	0
West DeLand	FL	3535
West Gate	FL	7975
West Hollywood	FL	60806
West Lealman	FL	0
West Little River	FL	34699
West Melbourne	FL	20679
West Miami	FL	5965
West Palm Beach	FL	120932
West Park	FL	15097
West Pensacola	FL	21339
West Perrine	FL	10602
West Samoset	FL	5583
West Vero Corridor	FL	7138
Westchase	FL	21747
Westchester	FL	29862
Westgate	FL	0
Westlake	FL	0
Weston	FL	69959
Westview	FL	9650
Westville	FL	275
Westwood Lake	FL	11838
Westwood Lakes	FL	0
Wewahitchka	FL	1995
Whiskey Creek	FL	4655
White	FL	0
White City	FL	3719
White Springs	FL	773
Whitfield	FL	2882
Wildwood	FL	6590
Williamsburg	FL	7646
Williston	FL	2746
Williston Highlands	FL	2275
Willow Oak	FL	6732
Wilton Manors	FL	12385
Wimauma	FL	6373
Windermere	FL	3249
Winding Cypress	FL	0
Windsor	FL	0
Winston	FL	9050
Winter Beach	FL	2067
Winter Garden	FL	40356
Winter Haven	FL	37689
Winter Park	FL	29943
Winter Springs	FL	34789
Wiscon	FL	706
Woodlawn Beach	FL	1785
Woodville	FL	2978
World Golf	FL	0
Worthington Springs	FL	389
Wright	FL	23127
Yalaha	FL	1364
Yankeetown	FL	501
Yeehaw Junction	FL	240
Youngstown	FL	4324
Yulee	FL	11491
Zellwood	FL	2817
Zephyrhills	FL	14611
Zephyrhills North	FL	2600
Zephyrhills South	FL	5276
Zephyrhills West	FL	5865
Zolfo Springs	FL	1803
Abbeville	GA	2815
Acworth	GA	22131
Adairsville	GA	4778
Adel	GA	5316
Adrian	GA	657
Ailey	GA	552
Alamo	GA	3330
Alapaha	GA	656
Albany	GA	74843
Aldora	GA	103
Allenhurst	GA	665
Allentown	GA	162
Alma	GA	3536
Alpharetta	GA	63693
Alston	GA	158
Alto	GA	1167
Ambrose	GA	380
Americus	GA	16028
Andersonville	GA	236
Antioch	GA	0
Appling	GA	0
Arabi	GA	563
Aragon	GA	1243
Arcade	GA	1799
Argyle	GA	215
Arlington	GA	1406
Arnoldsville	GA	354
Ashburn	GA	3820
Athens	GA	127315
Athens-Clarke County	GA	0
Atlanta	GA	510823
Attapulgus	GA	435
Auburn	GA	7524
Augusta	GA	43459
Augusta-Richmond County	GA	0
Austell	GA	7107
Avalon	GA	205
Avera	GA	233
Avondale Estates	GA	3139
Axson	GA	0
Baconton	GA	871
Bainbridge	GA	12507
Baldwin	GA	3286
Ball Ground	GA	1720
Barnesville	GA	6625
Bartow	GA	262
Barwick	GA	379
Baxley	GA	4440
Bellville	GA	122
Belvedere Park	GA	15152
Bemiss	GA	0
Berkeley Lake	GA	2024
Berlin	GA	559
Berry College	GA	0
Bethlehem	GA	671
Between	GA	324
Bibb City	GA	506
Bishop	GA	244
Blackshear	GA	3581
Blacksville	GA	4
Blairsville	GA	554
Blakely	GA	4871
Bloomingdale	GA	2764
Blue Ridge	GA	1286
Bluffton	GA	101
Blythe	GA	701
Bogart	GA	1042
Bolingbroke	GA	0
Bonanza	GA	3135
Boston	GA	1323
Bostwick	GA	369
Bowdon	GA	2072
Bowersville	GA	464
Bowman	GA	820
Box Springs	GA	0
Boykin	GA	143
Braselton	GA	9476
Braswell	GA	388
Bremen	GA	6355
Brinson	GA	209
Bristol	GA	0
Bronwood	GA	391
Brookhaven	GA	51910
Brooklet	GA	1457
Brooks	GA	547
Broxton	GA	1190
Brunswick	GA	16157
Buchanan	GA	1156
Buckhead	GA	171
Buena Vista	GA	2206
Buford	GA	13748
Butler	GA	1885
Byromville	GA	520
Byron	GA	5105
Cadwell	GA	530
Cairo	GA	9752
Calhoun	GA	16309
Calvary	GA	161
Camak	GA	131
Camilla	GA	5089
Candler-McAfee	GA	23025
Canon	GA	803
Canoochee	GA	71
Canton	GA	25469
Carl	GA	216
Carlton	GA	262
Carnesville	GA	580
Carrollton	GA	26203
Cartersville	GA	20319
Cataula	GA	0
Cave Spring	GA	1175
Cecil	GA	277
Cedar Springs	GA	74
Cedartown	GA	9750
Centerville	GA	7575
Centralhatchee	GA	393
Chamblee	GA	28244
Chatsworth	GA	4351
Chattahoochee Hills	GA	2690
Chattanooga Valley	GA	3846
Chauncey	GA	323
Cherry Log	GA	119
Chester	GA	1568
Chickamauga	GA	3107
Clarkesville	GA	1746
Clarkston	GA	12215
Claxton	GA	2334
Clayton	GA	2234
Clermont	GA	922
Cleveland	GA	3773
Climax	GA	273
Clyattville	GA	0
Cobbtown	GA	348
Cochran	GA	4363
Cogdell	GA	0
Cohutta	GA	637
Colbert	GA	600
Coleman	GA	127
College Park	GA	14601
Collins	GA	582
Colquitt	GA	1886
Columbus	GA	206922
Comer	GA	1138
Commerce	GA	6762
Concord	GA	380
Conley	GA	6228
Conyers	GA	15875
Coolidge	GA	526
Cordele	GA	10943
Corinth	GA	213
Cornelia	GA	4223
Country Club Estates	GA	8545
Covington	GA	13916
Crawford	GA	826
Crawfordville	GA	508
Crescent	GA	0
Crooked Creek	GA	0
Culloden	GA	177
Cumming	GA	5718
Cusseta	GA	11267
Cusseta-Chattahoochee County	GA	0
Cuthbert	GA	3670
Dacula	GA	5330
Dahlonega	GA	6394
Daisy	GA	143
Dallas	GA	12870
Dalton	GA	33853
Damascus	GA	238
Danielsville	GA	577
Danville	GA	218
Darien	GA	1858
Dasher	GA	963
Davisboro	GA	1986
Dawson	GA	4353
Dawsonville	GA	2525
De Soto	GA	0
Dearing	GA	547
Decatur	GA	21957
Deenwood	GA	2146
Deepstep	GA	128
Demorest	GA	2050
Denton	GA	251
DeSoto	GA	195
Dewy Rose	GA	154
Dexter	GA	570
Dillard	GA	334
Dixie	GA	0
Dixie Union	GA	0
Dock Junction	GA	7721
Doerun	GA	773
Donalsonville	GA	2675
Dooling	GA	148
Doraville	GA	10896
Douglas	GA	11718
Douglasville	GA	32897
Druid Hills	GA	14568
Du Pont	GA	124
Dublin	GA	16197
Dudley	GA	570
Duluth	GA	29193
Dunwoody	GA	48733
Dutch Island	GA	0
Eagle Grove	GA	164
East Dublin	GA	2392
East Ellijay	GA	556
East Griffin	GA	1451
East Newnan	GA	1321
East Point	GA	35467
Eastman	GA	5285
Eatonton	GA	6520
Echols County	GA	0
Edge Hill	GA	0
Edgehill	GA	24
Edison	GA	1478
Elberton	GA	4453
Ellaville	GA	1879
Ellenton	GA	279
Ellerslie	GA	0
Ellijay	GA	1680
Emerson	GA	1535
Empire	GA	393
Enigma	GA	1293
Ephesus	GA	420
Epworth	GA	480
Eton	GA	902
Euharlee	GA	4261
Eulonia	GA	0
Evans	GA	29011
Everett	GA	158
Experiment	GA	2894
Faceville	GA	0
Fair Oaks	GA	8225
Fairburn	GA	13967
Fairfield	GA	0
Fairmount	GA	736
Fairplay	GA	0
Fairview	GA	6769
Fargo	GA	325
Fayetteville	GA	16990
Firing Range	GA	2110
Fitzgerald	GA	9013
Flemington	GA	718
Flovilla	GA	634
Flowery Branch	GA	6683
Folkston	GA	5247
Forest Park	GA	19383
Forsyth	GA	4013
Fort Gaines	GA	1129
Fort Oglethorpe	GA	9803
Fort Stewart	GA	4924
Fort Valley	GA	8597
Franklin	GA	969
Franklin Springs	GA	1154
Funston	GA	443
Gainesville	GA	38712
Garden	GA	0
Garden City	GA	8999
Gardi	GA	0
Garfield	GA	204
Gay	GA	86
Geneva	GA	100
Georgetown	GA	11823
Georgetown-Quitman County	GA	0
Gibson	GA	657
Gillsville	GA	247
Girard	GA	153
Glenn	GA	0
Glennville	GA	5086
Glenwood	GA	739
Godfrey	GA	0
Good Hope	GA	289
Gordon	GA	1956
Gough	GA	0
Graham	GA	299
Grantville	GA	3183
Gray	GA	3269
Grayson	GA	3147
Greensboro	GA	3403
Greenville	GA	862
Gresham Park	GA	7432
Griffin	GA	23211
Grovetown	GA	13093
Gum Branch	GA	264
Gumbranch	GA	0
Gumlog	GA	2146
Guyton	GA	1856
Hagan	GA	967
Hahira	GA	2899
Hamilton	GA	1158
Hampton	GA	7372
Hannahs Mill	GA	3298
Hapeville	GA	6650
Haralson	GA	174
Hardwick	GA	3930
Harlem	GA	2967
Harrison	GA	467
Hartwell	GA	4514
Hawkinsville	GA	5471
Hazlehurst	GA	4196
Helen	GA	532
Helena	GA	2883
Henderson	GA	1647
Hephzibah	GA	3936
Heron Bay	GA	0
Hiawassee	GA	906
Hickox	GA	0
Higgston	GA	313
Hilltop	GA	262
Hiltonia	GA	326
Hinesville	GA	33398
Hiram	GA	3792
Hoboken	GA	531
Hogansville	GA	3110
Holly Springs	GA	10719
Homeland	GA	871
Homer	GA	1144
Homerville	GA	2480
Hortense	GA	0
Hoschton	GA	1433
Howard	GA	110
Hull	GA	201
Ideal	GA	459
Ila	GA	341
Indian Springs	GA	2413
Iron	GA	0
Iron City	GA	309
Irondale	GA	7446
Irwinton	GA	562
Isle of Hope	GA	2402
Ivey	GA	926
Jackson	GA	4983
Jacksonville	GA	135
Jakin	GA	150
Jasper	GA	3762
Jefferson	GA	10195
Jeffersonville	GA	1050
Jekyll Island	GA	866
Jenkinsburg	GA	367
Jersey	GA	143
Jesup	GA	9633
Johns Creek	GA	83335
Jonesboro	GA	4746
Juliette	GA	0
Junction	GA	0
Junction City	GA	165
Kennesaw	GA	33584
Kennesaw State University	GA	0
Keysville	GA	348
Kings Bay Base	GA	1777
Kingsland	GA	16487
Kingston	GA	666
Kite	GA	225
Knoxville	GA	69
LaFayette	GA	7173
LaGrange	GA	29588
Lake	GA	0
Lake City	GA	2727
Lake Park	GA	730
Lakeland	GA	3322
Lakeview	GA	4839
Lakeview Estates	GA	2695
Lavonia	GA	2165
Lawrenceville	GA	30493
Leary	GA	589
Leesburg	GA	2983
Lenox	GA	852
Leslie	GA	388
Lexington	GA	227
Lilburn	GA	12655
Lilly	GA	204
Lincoln Park	GA	833
Lincolnton	GA	1479
Lindale	GA	4191
Linwood	GA	364
Lithia Springs	GA	15491
Lithonia	GA	2022
Locust Grove	GA	5790
Loganville	GA	11248
Lone Oak	GA	89
Lookout Mountain	GA	1579
Louisville	GA	2358
Lovejoy	GA	6487
Ludowici	GA	2081
Lula	GA	2879
Lumber	GA	0
Lumber City	GA	1254
Lumpkin	GA	1093
Luthersville	GA	824
Lyerly	GA	529
Lyons	GA	4375
Mableton	GA	37115
Macon	GA	91351
Macon-Bibb County	GA	0
Madison	GA	4026
Manassas	GA	95
Manchester	GA	4095
Manor	GA	0
Mansfield	GA	433
Marietta	GA	59067
Marshallville	GA	1333
Martin	GA	367
Martinez	GA	35795
Matthews	GA	150
Maxeys	GA	224
Maysville	GA	1866
McCaysville	GA	1083
McDonough	GA	23417
McIntyre	GA	620
McRae	GA	5740
McRae-Helena	GA	0
Meansville	GA	183
Meigs	GA	1030
Mendes	GA	122
Menlo	GA	468
Mershon	GA	0
Metter	GA	4111
Midville	GA	263
Midway	GA	2007
Milan	GA	766
Milledgeville	GA	18931
Millen	GA	2925
Millwood	GA	0
Milner	GA	601
Milstead	GA	0
Milton	GA	37547
Mineral Bluff	GA	150
Mitchell	GA	201
Molena	GA	372
Monroe	GA	13641
Montezuma	GA	3189
Montgomery	GA	4523
Monticello	GA	2615
Montrose	GA	213
Moody A F B	GA	886
Moody AFB	GA	0
Moreland	GA	422
Morgan	GA	1849
Morganton	GA	303
Morrow	GA	7338
Morven	GA	532
Moultrie	GA	14377
Mount Airy	GA	1292
Mount Vernon	GA	2276
Mount Zion	GA	1737
Mountain	GA	0
Mountain City	GA	1061
Mountain Park	GA	11554
Musella	GA	0
Nahunta	GA	1060
Nashville	GA	4854
Naylor	GA	110
Nelson	GA	1347
New England	GA	0
Newborn	GA	734
Newington	GA	268
Newnan	GA	37291
Newton	GA	594
Nicholls	GA	3331
Nicholson	GA	1718
Norcross	GA	16634
Norman Park	GA	963
Norristown	GA	59
North Decatur	GA	16698
North Druid Hills	GA	18947
North High Shoals	GA	699
Norwood	GA	227
Nunez	GA	149
Oak Park	GA	481
Oakwood	GA	4178
Ochlocknee	GA	679
Ocilla	GA	3387
Oconee	GA	257
Odum	GA	505
Offerman	GA	440
Oglethorpe	GA	1211
Ohoopee	GA	0
Oliver	GA	226
Omaha	GA	116
Omega	GA	1230
Orchard Hill	GA	207
Oxford	GA	2197
Palmetto	GA	4733
Panthersville	GA	9749
Parrott	GA	152
Patterson	GA	751
Pavo	GA	617
Payne	GA	218
Peachtree	GA	0
Peachtree City	GA	35240
Peachtree Corners	GA	40978
Pearson	GA	2112
Pelham	GA	3708
Pembroke	GA	2445
Pendergrass	GA	447
Perkins	GA	91
Perry	GA	15457
Phillipsburg	GA	707
Pine Lake	GA	763
Pine Mountain	GA	1358
Pinehurst	GA	336
Pineview	GA	503
Piney Grove	GA	0
Pitts	GA	308
Plains	GA	740
Plainville	GA	321
Pooler	GA	23133
Port Wentworth	GA	7637
Portal	GA	617
Porterdale	GA	1483
Poulan	GA	803
Powder Springs	GA	14826
Preston	GA	419
Pulaski	GA	203
Putney	GA	2898
Quitman	GA	3871
Ranger	GA	134
Raoul	GA	2558
Ray	GA	0
Ray City	GA	1053
Rayle	GA	190
Rebecca	GA	172
Redan	GA	33015
Reed Creek	GA	2604
Register	GA	172
Reidsville	GA	2616
Remerton	GA	1127
Rentz	GA	292
Resaca	GA	775
Rest Haven	GA	148
Reynolds	GA	1026
Reynoldstown	GA	1733
Rhine	GA	377
Riceboro	GA	771
Richland	GA	1496
Richmond Hill	GA	11935
Riddleville	GA	94
Rincon	GA	9843
Ringgold	GA	3700
Riverdale	GA	15989
Riverside	GA	35
Roberta	GA	996
Robins AFB	GA	0
Robins Air Force Base	GA	1170
Rochelle	GA	1120
Rock Spring	GA	0
Rockingham	GA	248
Rockmart	GA	4300
Rocky Ford	GA	142
Rome	GA	36323
Roopville	GA	225
Rossville	GA	3997
Roswell	GA	94501
Royston	GA	2574
Russell	GA	1203
Rutledge	GA	793
Rydal	GA	4087
Saint Simon Mills	GA	13915
Saint Simons Island	GA	13000
Sale	GA	0
Sale City	GA	355
Salem	GA	310
Sandersville	GA	5752
Sandy Springs	GA	105330
Santa Claus	GA	166
Sardis	GA	1229
Sasser	GA	264
Satilla	GA	421
Sautee-Nacoochee	GA	0
Savannah	GA	147780
Scotland	GA	344
Scottdale	GA	10631
Screven	GA	767
Senoia	GA	4073
Seville	GA	202
Shady Dale	GA	240
Shannon	GA	1862
Sharon	GA	135
Sharpsburg	GA	354
Shellman	GA	989
Shiloh	GA	443
Siloam	GA	280
Skidaway Island	GA	8341
Sky Valley	GA	265
Smarr	GA	0
Smithville	GA	585
Smyrna	GA	56146
Snellville	GA	19733
Social Circle	GA	4383
Soperton	GA	3087
South Fulton	GA	107436
Sparks	GA	2007
Sparta	GA	1293
Springfield	GA	2889
St. Marys	GA	17968
St. Simons	GA	0
Stapleton	GA	405
Statenville	GA	1040
Statesboro	GA	30721
Statham	GA	2624
Sterling	GA	2534
Stillmore	GA	528
Stockbridge	GA	28202
Stockton	GA	0
Stone Mountain	GA	6109
Stonecrest	GA	50000
Sugar Hill	GA	21747
Summertown	GA	163
Summerville	GA	4452
Sumner	GA	403
Sunny Side	GA	132
Sunnyside	GA	1303
Sunset	GA	0
Sunset Village	GA	846
Surrency	GA	207
Suwanee	GA	18694
Swainsboro	GA	7471
Sycamore	GA	674
Sylvania	GA	2538
Sylvester	GA	6049
Talahi Island	GA	0
Talbotton	GA	887
Talking Rock	GA	66
Tallapoosa	GA	3171
Tallulah Falls	GA	168
Talmo	GA	572
Tarrytown	GA	86
Tate	GA	0
Tate City	GA	16
Taylorsville	GA	214
Tazewell	GA	0
Temple	GA	4313
Tennille	GA	1773
The Rock	GA	160
Thomaston	GA	9032
Thomasville	GA	18742
Thomson	GA	6689
Thunderbolt	GA	2622
Tifton	GA	16725
Tiger	GA	401
Tignall	GA	513
Toccoa	GA	8283
Toomsboro	GA	451
Trenton	GA	2238
Trion	GA	1785
Tucker	GA	27581
Tunnel Hill	GA	877
Turin	GA	343
Twin	GA	0
Twin City	GA	1674
Ty Ty	GA	727
Tybee Island	GA	3102
Tyrone	GA	7194
Unadilla	GA	3666
Union	GA	0
Union City	GA	20805
Union Point	GA	1709
Unionville	GA	1845
Uvalda	GA	585
Valdosta	GA	55724
Varnell	GA	1790
Vernonburg	GA	131
Vidalia	GA	10679
Vidette	GA	110
Vienna	GA	3777
Villa Rica	GA	14904
Vinings	GA	9734
Waco	GA	518
Wadley	GA	2031
Waleska	GA	802
Walnut Grove	GA	1378
Walthourville	GA	3974
Waresboro	GA	0
Warm Springs	GA	404
Warner Robins	GA	73490
Warrenton	GA	1812
Warthen	GA	0
Warwick	GA	407
Washington	GA	3981
Watkinsville	GA	2872
Waverly	GA	0
Waverly Hall	GA	823
Waycross	GA	14053
Waynesboro	GA	5704
Waynesville	GA	0
Webster County	GA	0
Wenona	GA	0
West Brow	GA	0
West Point	GA	3728
West Warrenton	GA	2300
Weston	GA	69
Whigham	GA	478
White	GA	724
White Plains	GA	291
Whitemarsh Island	GA	6792
Whitesburg	GA	596
Wildwood	GA	0
Willacoochee	GA	1393
Williamson	GA	356
Wilmington Island	GA	15138
Winder	GA	15447
Winterville	GA	1172
Woodbine	GA	1285
Woodbury	GA	909
Woodland	GA	367
Woodstock	GA	29898
Woodville	GA	336
Woolsey	GA	166
Wrens	GA	2051
Wrightsville	GA	3642
Yatesville	GA	341
Yonah	GA	507
Young Harris	GA	1325
Zebulon	GA	1153
'A'ala	HI	4302
‘Āhuimanu	HI	8810
‘Aiea	HI	9338
‘Aiea Heights	HI	5487
‘Ālewa Heights	HI	2305
‘Ele‘ele	HI	2390
‘Ewa Beach	HI	16415
‘Ewa Gentry	HI	22690
‘Ewa Villages	HI	6108
‘Ōma‘o	HI	1301
‘Ualapu‘e	HI	425
Ahuimanu	HI	0
Aiea	HI	0
Aina Haina	HI	3558
Aina Haina-Hawaii Loa Ridge	HI	3608
Ainaloa	HI	2965
Airport	HI	28916
Ala Moana	HI	5579
Ala Moana - Kakaʻako	HI	18957
Aliamanu / Salt Lakes / Foster Village	HI	38833
Aliamanu Makai	HI	2374
Aliamanu Mauka	HI	1047
Anahola	HI	2223
Barbers Point Housing	HI	2364
Black Sands	HI	416
Camp H.M. Smith	HI	6626
Captain Cook	HI	3429
Chinatown	HI	3001
Diamond Head	HI	1276
Diamond Head / Kapahulu / Saint Louis Heights	HI	19769
Discovery Harbor	HI	1171
Discovery Harbour	HI	0
Downtown	HI	12381
Dowsett Highlands	HI	5360
East Honolulu	HI	49914
East Kapolei	HI	5299
East Manoa	HI	2251
Eden Roc	HI	1386
Eleele	HI	0
Enchanted Lake	HI	5089
Ewa Beach	HI	0
Ewa Gentry	HI	0
Ewa Villages	HI	0
Farrington	HI	5124
Fern Acres	HI	1504
Fern Forest	HI	1150
Financial District	HI	1627
Ford Island	HI	7651
Fort Shafter	HI	1060
Hā‘ena	HI	431
Haena	HI	0
Haʻikū	HI	8694
Haiku-Pauwela	HI	9245
Hala‘ula	HI	469
Halaula	HI	0
Hālawa	HI	14014
Hālawa Heights	HI	13408
Hale‘iwa	HI	3970
Haleiwa	HI	0
Haliimaile	HI	1074
Hana	HI	1235
Hanalei	HI	450
Hanamā‘ulu	HI	3835
Hanamaulu	HI	0
Hanapēpē	HI	2638
Hanapēpē Heights	HI	2692
Hau‘ula	HI	4148
Hauʻula-Punaluʻu	HI	3363
Hauula	HI	0
Hawai‘i Kai	HI	30620
Hawaiian Acres	HI	2700
Hawaiian Beaches	HI	4280
Hawaiian Ocean View	HI	4437
Hawaiian Paradise Park	HI	11404
Hāwī	HI	1081
He‘eia	HI	4963
Heeia	HI	0
Helemano	HI	2549
Hickam Field	HI	6920
Hickam Housing	HI	0
Hilo	HI	43263
Ho‘olehua	HI	1370
Hōlualoa	HI	8538
Honalo	HI	2423
Honaunau-Napoopoo	HI	2567
Honoka‘a	HI	2258
Honokaa	HI	0
Honolulu	HI	350964
Honomu	HI	509
Huelo	HI	2340
ʻEwa Beach-Iroquois Point	HI	21088
ʻEwa Gentry-West Loch	HI	35828
ʻEwa Villages-Honouliuli	HI	6699
Iroquois Point	HI	4553
Iwilei-Anuenue	HI	2483
Joint Base Pearl Harbor Hickam	HI	42184
Ka‘a‘awa	HI	1379
Kā‘anapali	HI	1045
Kaaawa	HI	0
Kaanapali	HI	0
Kaanapali Landing	HI	1943
Kahalu‘u	HI	4738
Kahaluu	HI	0
Kahaluu-Keauhou	HI	3549
Kahuku	HI	2614
Kahuku-Kawela	HI	2639
Kahului	HI	26337
Kailua	HI	38635
Kailua Town	HI	3664
Kailua-Kona	HI	11975
Kaiminani	HI	0
Kaimukī	HI	20878
Kakaʻako	HI	10673
Kalaeloa	HI	0
Kalaeloa-Campbell Industrial Park	HI	2971
Kalāheo	HI	4595
Kalaheo Hillside	HI	3256
Kalama Valley	HI	4254
Kalanipuu	HI	2195
Kalaoa	HI	9644
Kalapana	HI	0
Kalaupapa	HI	90
Kalihi Valley	HI	20647
Kalihi Wai	HI	428
Kalihi-Palama	HI	43805
Kalihiwai	HI	0
Kaloko	HI	0
Kamaili	HI	0
Kamehameha Heights	HI	3079
Kaneohe	HI	34597
Kaneohe Base	HI	0
Kapa‘a	HI	10699
Kapaa	HI	0
Kapaau	HI	1734
Kapalua	HI	353
Kapolei	HI	15186
Kapolei Villages	HI	15408
Kaumakani	HI	749
Kaumakani-Hanapepe	HI	3769
Kaunakakai	HI	3425
Kawailoa	HI	3768
Kawela Bay	HI	330
Kea‘au	HI	2253
Keaau	HI	0
Kealakekua	HI	2019
Keālia	HI	103
Kekaha	HI	3537
Kekaha-Waimea	HI	5971
Kēōkea	HI	1612
Keolu Hills	HI	6143
Kīhei	HI	20881
Kihei Mauka	HI	4722
Kīlauea	HI	2803
Ko ʻOlina-Honokai Hale	HI	2871
Ko Olina	HI	1799
Koloa	HI	2144
Koloa-Poipu	HI	2936
Koolauloa	HI	15697
Kuakini	HI	4106
Kualapu‘u	HI	2027
Kualapuu	HI	0
Kukuihaele	HI	336
Kula	HI	6452
Kuli‘ou‘ou	HI	5745
Kuliouou - Kalani Iki	HI	16195
Kunia Camp	HI	202
Kurtistown	HI	1298
Lā‘ie	HI	6138
Lahaina	HI	11704
Laie	HI	0
Lanai	HI	0
Lanai City	HI	3102
Lanikai	HI	1841
Launiupoko	HI	588
Laupāhoehoe	HI	1147
Lawai	HI	2363
Leilani Estates	HI	1560
Lihue	HI	6455
Liliha - Kapalama	HI	24953
Lower Aiea	HI	4921
Lower McCully	HI	2912
Lower Palolo	HI	3257
Lower Pawaa	HI	3941
Lower Pearl City	HI	2005
Lower Waiau	HI	2897
Lower Wilhelmina	HI	3039
Mā‘alaea	HI	352
Mā‘ili	HI	9488
Maalaea	HI	0
Māhinahina	HI	910
Maili	HI	0
Mākaha	HI	8278
Mākaha Valley	HI	1341
Mākaha-Kaʻena	HI	9364
Makakilo	HI	18248
Makakilo / Kapolei / Honokai Hale	HI	46389
Makakilo City	HI	15383
Makakilo-Makaīwa Hills-Kunia	HI	20967
Makawao	HI	7184
Mākena	HI	196
Makiki / Lower Punchbowl / Tantalus	HI	31434
Makua Valley	HI	3805
Manana Housing	HI	1655
Manele	HI	7
Manoa	HI	23343
Marine Corps Base Hawaii - MCBH	HI	9517
Mariner's Ridge	HI	1464
Mauliola	HI	184
Mauna Loa Estates	HI	0
Maunaloa	HI	435
Maunawili	HI	3697
Mayor Wright Housing	HI	1545
McCully - Moiliili	HI	28249
Mililani	HI	0
Mililani Mauka	HI	21075
Mililani Mauka / Launani Valley	HI	18072
Mililani Town	HI	27629
Miloli‘i	HI	400
Mō‘ili‘ili	HI	24778
Moanalua	HI	9461
Moanalua Valley	HI	7162
Mokulēia	HI	1811
Mountain View	HI	3924
Naalehu	HI	866
Nānākuli	HI	12666
Nanawale Estates	HI	1426
Napili-Honokowai	HI	7261
Newtown	HI	3384
Niu Valley	HI	19250
Nuuanu - Punchbowl	HI	16205
Ocean Pointe	HI	8361
Olinda	HI	0
Olinda, CDP	HI	1188
Olomana	HI	1312
Olowalu	HI	100
Omao	HI	0
Omao-Kukuiula	HI	3538
Orchidlands Estates	HI	2815
Pa‘auilo	HI	595
Paauilo	HI	0
Pacific Palisades	HI	6997
Pāhala	HI	1356
Pāhoa	HI	924
Paia	HI	2668
Pakala	HI	0
Pākalā Village	HI	294
Palama	HI	2157
Palolo	HI	12620
Pāpa‘ikou	HI	1314
Papaikou	HI	0
Paukaa	HI	425
Pauoa	HI	5165
Pearl	HI	0
Pearl City	HI	47698
Pepeekeo	HI	1789
Po‘ipū	HI	1299
Pōhākupu	HI	895
Poipu	HI	0
Portlock	HI	1726
Princeville	HI	2158
Pū‘ōhala Village	HI	3921
Pu‘uwai	HI	130
Puako	HI	772
Puhi	HI	2906
Puʻunēnē	HI	50
Pukalani	HI	7574
Punahou	HI	5057
Punalu‘u	HI	1164
Punaluu	HI	0
Pupukea	HI	5130
Robinson Heights	HI	5128
Royal Hawaiian Estates	HI	0
Royal Kunia	HI	14525
Schofield Barracks	HI	16370
Schofield-Wheeler	HI	20452
Seaview	HI	0
Spreckelsville	HI	6276
St. Louis Heights	HI	4131
Sunset Beach-Pūpūkea	HI	5235
Tantalus	HI	2023
Tiki Gardens	HI	0
Ualapue	HI	0
Upper Kalihi Valley	HI	4694
Upper Manoa	HI	3345
Upper Palolo	HI	3145
Upper Pauoa	HI	2550
Urban Honolulu	HI	0
Village Park	HI	11099
Volcano	HI	2575
Volcano Golf Course	HI	0
Wahiawā	HI	17821
Wahiawā-Whitmore	HI	22448
Wai‘ōhinu	HI	198
Waiahole-Waikane	HI	0
Waialae - Kahala	HI	3872
Waialae Iki	HI	4174
Waialae Nui Ridge-Ainakoa	HI	2758
Waialua	HI	3860
Waianae	HI	13177
Waiau-Pacific Palisades	HI	47591
Waiawa	HI	250
Waihee-Waiehu	HI	8841
Waiʻalae Nui-Country Club	HI	3447
Waikane	HI	778
Waikapū	HI	2965
Waikele	HI	0
Waikīkī	HI	19862
Waikoloa	HI	4806
Waikoloa Beach Resort	HI	0
Wailea	HI	5938
Wailea-Makena	HI	5671
Wailua	HI	2254
Wailua Homesteads	HI	5188
Wailuku	HI	15313
Wailupe	HI	2702
Waimalu	HI	13730
Waimanalo	HI	5451
Waimānalo Beach	HI	4481
Waimea	HI	9212
Wainaku	HI	1224
Wainiha	HI	318
Waiohinu	HI	0
Waipahu	HI	38216
Waipi‘o Acres	HI	5531
Waipio	HI	11674
Waipio Acres	HI	0
Ward Village	HI	3929
West Loch Estate	HI	0
West Loch Estates	HI	5523
Wheeler AFB	HI	0
Wheeler Army Airfield	HI	2412
Whitmore	HI	0
Whitmore Village	HI	4499
Ackley	IA	1560
Ackworth	IA	86
Adair	IA	728
Adel	IA	4245
Afton	IA	829
Agency	IA	641
Ainsworth	IA	571
Akron	IA	1450
Albert	IA	0
Albert City	IA	688
Albia	IA	3829
Albion	IA	476
Alburnett	IA	695
Alden	IA	764
Alexander	IA	170
Algona	IA	5470
Alleman	IA	443
Allerton	IA	495
Allison	IA	1029
Alta	IA	1883
Alta Vista	IA	261
Alton	IA	1264
Altoona	IA	16984
Alvord	IA	193
Amana	IA	442
Ames	IA	65060
Anamosa	IA	5469
Anderson	IA	65
Andover	IA	100
Andrew	IA	422
Anita	IA	956
Ankeny	IA	56764
Anthon	IA	569
Aplington	IA	1079
Arcadia	IA	471
Archer	IA	127
Aredale	IA	74
Argo	IA	0
Argyle	IA	0
Arion	IA	107
Arispe	IA	99
Arlington	IA	410
Armstrong	IA	889
Arnolds Park	IA	1234
Arthur	IA	204
Asbury	IA	5291
Ashton	IA	430
Aspinwall	IA	40
Atalissa	IA	306
Athelstan	IA	19
Atkins	IA	1795
Atlantic	IA	6833
Auburn	IA	314
Audubon	IA	2017
Augusta	IA	51
Aurelia	IA	992
Aurora	IA	171
Avoca	IA	1504
Ayrshire	IA	140
Badger	IA	550
Bagley	IA	296
Baldwin	IA	106
Balltown	IA	65
Bancroft	IA	710
Bankston	IA	25
Barnes	IA	0
Barnes City	IA	174
Barnum	IA	190
Bartlett	IA	50
Bassett	IA	65
Batavia	IA	516
Battle Creek	IA	695
Baxter	IA	1103
Bayard	IA	456
Beacon	IA	480
Beaconsfield	IA	15
Beaman	IA	192
Beaver	IA	48
Beaverdale	IA	952
Bedford	IA	1415
Belle Plaine	IA	2475
Bellevue	IA	2176
Belmond	IA	2314
Bennett	IA	394
Bentley	IA	118
Benton	IA	43
Berkley	IA	32
Bernard	IA	109
Bertram	IA	300
Bettendorf	IA	35505
Bevington	IA	62
Big Rock	IA	0
Birmingham	IA	433
Blairsburg	IA	212
Blairstown	IA	670
Blakesburg	IA	286
Blanchard	IA	37
Blencoe	IA	217
Blockton	IA	191
Bloomfield	IA	2617
Blue Grass	IA	1676
Bode	IA	293
Bolan	IA	33
Bonaparte	IA	419
Bondurant	IA	4996
Boone	IA	12692
Bouton	IA	134
Boxholm	IA	197
Boyden	IA	708
Braddyville	IA	155
Bradford	IA	99
Bradgate	IA	84
Brandon	IA	307
Brayton	IA	119
Breda	IA	475
Bridgewater	IA	172
Brighton	IA	659
Bristow	IA	160
Britt	IA	1973
Bronson	IA	323
Brooklyn	IA	1420
Brunsville	IA	148
Buck Grove	IA	51
Buckeye	IA	108
Buffalo	IA	1299
Buffalo (historical)	IA	1262
Buffalo Center	IA	895
Burchinal	IA	40
Burlington	IA	25410
Burr Oak	IA	166
Burt	IA	511
Bussey	IA	410
Calamus	IA	414
California Junction	IA	85
Callender	IA	365
Calmar	IA	960
Calumet	IA	169
Camanche	IA	4341
Cambridge	IA	821
Cantril	IA	220
Carbon	IA	32
Carlisle	IA	4168
Carpenter	IA	108
Carroll	IA	9968
Carson	IA	816
Carter Lake	IA	3791
Cascade	IA	2271
Casey	IA	402
Castalia	IA	168
Castana	IA	137
Cedar Falls	IA	41255
Cedar Rapids	IA	130405
Center Junction	IA	111
Center Point	IA	2521
Centerville	IA	5745
Central	IA	0
Central City	IA	1269
Centralia	IA	130
Chapin	IA	87
Chariton	IA	4214
Charles	IA	0
Charles City	IA	7455
Charlotte	IA	370
Charter Oak	IA	492
Chatsworth	IA	80
Chelsea	IA	261
Cherokee	IA	5030
Chester	IA	125
Chillicothe	IA	96
Churdan	IA	369
Cincinnati	IA	345
Clare	IA	142
Clarence	IA	970
Clarinda	IA	5418
Clarion	IA	2767
Clarksville	IA	1409
Clayton	IA	42
Clear Lake	IA	7590
Clearfield	IA	347
Cleghorn	IA	227
Clemons	IA	150
Clermont	IA	609
Climbing Hill	IA	97
Clinton	IA	26064
Clio	IA	80
Clive	IA	15447
Clutier	IA	209
Coalville	IA	610
Coburg	IA	40
Coggon	IA	659
Coin	IA	184
Colesburg	IA	397
Colfax	IA	2051
College Springs	IA	208
Collins	IA	483
Colo	IA	861
Columbus	IA	0
Columbus City	IA	371
Columbus Junction	IA	1860
Colwell	IA	72
Conesville	IA	418
Conrad	IA	1100
Conroy	IA	259
Conway	IA	41
Coon Rapids	IA	1269
Coppock	IA	47
Coralville	IA	20608
Corley	IA	26
Corning	IA	1537
Correctionville	IA	811
Corwith	IA	269
Corydon	IA	1589
Cotter	IA	47
Coulter	IA	271
Council Bluffs	IA	62597
Craig	IA	87
Crawfordsville	IA	269
Crescent	IA	630
Cresco	IA	3833
Creston	IA	7854
Cromwell	IA	106
Crystal Lake	IA	245
Cumberland	IA	253
Cumming	IA	397
Curlew	IA	57
Cushing	IA	223
Cylinder	IA	88
Dakota	IA	0
Dakota City	IA	813
Dallas Center	IA	1792
Dana	IA	69
Danbury	IA	342
Danville	IA	936
Davenport	IA	102582
Davis	IA	0
Davis City	IA	195
Dawson	IA	138
Dayton	IA	798
De Soto	IA	1089
De Witt	IA	5242
Decatur	IA	188
Decorah	IA	7907
Dedham	IA	263
Deep River	IA	270
Defiance	IA	279
Delaware	IA	156
Delhi	IA	471
Delmar	IA	502
Deloit	IA	264
Delphos	IA	25
Delta	IA	317
Denison	IA	8334
Denmark	IA	423
Denver	IA	1835
Derby	IA	113
Des Moines	IA	214133
DeWitt	IA	0
Dexter	IA	630
Diagonal	IA	328
Diamondhead Lake	IA	366
Dickens	IA	182
Dike	IA	1289
Dixon	IA	248
Dolliver	IA	66
Donahue	IA	369
Donnan	IA	7
Donnellson	IA	901
Doon	IA	591
Douds	IA	152
Dougherty	IA	56
Dow	IA	0
Dow City	IA	499
Downey	IA	0
Dows	IA	514
Drakesville	IA	186
Dubuque	IA	58799
Dumont	IA	627
Duncan	IA	131
Duncombe	IA	394
Dundee	IA	170
Dunkerton	IA	842
Dunlap	IA	977
Durango	IA	24
Durant	IA	1816
Dyersville	IA	4204
Dysart	IA	1354
Eagle Grove	IA	3419
Earlham	IA	1405
Earling	IA	425
Earlville	IA	790
Early	IA	532
East Amana	IA	56
East Peru	IA	122
East Pleasant Plain	IA	129
Eddyville	IA	1012
Edgewood	IA	867
Elberon	IA	193
Eldon	IA	915
Eldora	IA	2702
Eldridge	IA	6232
Elgin	IA	649
Elk Horn	IA	638
Elk Run Heights	IA	1134
Elkader	IA	1213
Elkhart	IA	742
Elkport	IA	36
Elliott	IA	328
Ellston	IA	42
Ellsworth	IA	509
Elma	IA	539
Ely	IA	2074
Emerson	IA	425
Emmetsburg	IA	3811
Epworth	IA	1955
Essex	IA	770
Estherville	IA	6011
Evansdale	IA	4812
Everly	IA	581
Exira	IA	788
Exline	IA	157
Fairbank	IA	1117
Fairfax	IA	2497
Fairfield	IA	9892
Fairport	IA	0
Farley	IA	1691
Farmersburg	IA	277
Farmington	IA	649
Farnhamville	IA	359
Farragut	IA	439
Fayette	IA	1491
Fenton	IA	263
Ferguson	IA	127
Fertile	IA	372
Floris	IA	140
Floyd	IA	328
Fonda	IA	607
Fontanelle	IA	636
Forest	IA	0
Forest City	IA	4018
Fort Atkinson	IA	336
Fort Dodge	IA	24649
Fort Madison	IA	10717
Fostoria	IA	240
Franklin	IA	139
Fraser	IA	103
Fredericksburg	IA	922
Frederika	IA	181
Fredonia	IA	239
Fremont	IA	729
Fruitland	IA	977
Frytown	IA	165
Galt	IA	31
Galva	IA	432
Garber	IA	85
Garden	IA	0
Garden City	IA	89
Garden Grove	IA	205
Garnavillo	IA	726
Garner	IA	3107
Garrison	IA	363
Garwin	IA	508
Geneva	IA	176
George	IA	1055
Gibson	IA	60
Gilbert	IA	1116
Gilbertville	IA	747
Gillett Grove	IA	48
Gilman	IA	504
Gilmore	IA	0
Gilmore City	IA	491
Gladbrook	IA	890
Glenwood	IA	5253
Glidden	IA	1127
Goldfield	IA	608
Goodell	IA	135
Goose Lake	IA	235
Gowrie	IA	999
Graettinger	IA	811
Graf	IA	78
Grafton	IA	253
Grand Junction	IA	789
Grand Mound	IA	617
Grand River	IA	225
Grandview	IA	534
Granger	IA	1431
Grant	IA	88
Granville	IA	317
Gravity	IA	187
Gray	IA	59
Greeley	IA	251
Green Island	IA	55
Green Mountain	IA	126
Greene	IA	1120
Greenfield	IA	1883
Greenville	IA	74
Grimes	IA	10676
Grinnell	IA	9141
Griswold	IA	984
Grundy Center	IA	2714
Gruver	IA	92
Guernsey	IA	61
Guthrie Center	IA	1513
Guttenberg	IA	1861
Halbur	IA	246
Hamburg	IA	1082
Hamilton	IA	129
Hampton	IA	4290
Hancock	IA	195
Hanlontown	IA	227
Hansell	IA	95
Harcourt	IA	294
Hardy	IA	46
Harlan	IA	5002
Harper	IA	109
Harpers Ferry	IA	319
Harris	IA	164
Hartford	IA	762
Hartley	IA	1616
Hartwick	IA	86
Harvey	IA	238
Hastings	IA	150
Havelock	IA	133
Haverhill	IA	175
Hawarden	IA	2551
Hawkeye	IA	423
Hayesville	IA	49
Hayfield	IA	43
Hazleton	IA	818
Hedrick	IA	744
Henderson	IA	183
Hepburn	IA	22
Hiawatha	IA	7199
High Amana	IA	115
Hills	IA	822
Hillsboro	IA	180
Hinton	IA	938
Holiday Lake	IA	433
Holland	IA	280
Holstein	IA	1391
Holy Cross	IA	381
Homestead	IA	148
Hopkinton	IA	613
Hornick	IA	226
Hospers	IA	714
Houghton	IA	144
Hubbard	IA	834
Hudson	IA	2381
Hull	IA	2244
Humboldt	IA	4596
Humeston	IA	491
Hutchins	IA	28
Huxley	IA	3536
Ida Grove	IA	2122
Imogene	IA	66
Independence	IA	6028
Indianola	IA	15467
Inwood	IA	811
Ionia	IA	286
Iowa	IA	0
Iowa City	IA	74220
Iowa Falls	IA	5195
Ireton	IA	602
Irvington	IA	38
Irwin	IA	333
Jackson Junction	IA	56
Jacksonville	IA	30
Jamaica	IA	219
Janesville	IA	954
Jefferson	IA	4204
Jesup	IA	2671
Jewell	IA	1188
Jewell Junction	IA	0
Johnston	IA	20871
Joice	IA	223
Jolley	IA	27
Kalona	IA	2509
Kamrar	IA	198
Kanawha	IA	627
Kellerton	IA	312
Kelley	IA	309
Kellogg	IA	592
Kensett	IA	267
Kent	IA	61
Kent Estates	IA	0
Keokuk	IA	10609
Keomah	IA	0
Keomah Village	IA	83
Keosauqua	IA	947
Keota	IA	970
Keswick	IA	240
Keystone	IA	609
Kimballton	IA	301
Kingsley	IA	1396
Kingston	IA	81
Kinross	IA	71
Kirkman	IA	62
Kirkville	IA	175
Kiron	IA	277
Klemme	IA	484
Knierim	IA	60
Knoxville	IA	7248
La Motte	IA	253
La Porte	IA	0
La Porte City	IA	2290
Lacona	IA	363
Ladora	IA	283
Lake	IA	0
Lake City	IA	1670
Lake Mills	IA	2060
Lake Panorama	IA	1309
Lake Park	IA	1137
Lake View	IA	1125
Lakeside	IA	700
Lakota	IA	287
Lambs Grove	IA	172
Lamoni	IA	2376
Lamont	IA	457
Lanesboro	IA	116
Lansing	IA	939
Larchwood	IA	886
Larrabee	IA	133
Latimer	IA	483
Laurel	IA	242
Laurens	IA	1180
Lawler	IA	423
Lawton	IA	960
Le Claire	IA	3982
Le Grand	IA	946
Le Mars	IA	9761
Le Roy	IA	14
Leando	IA	115
Ledyard	IA	127
Lehigh	IA	399
Leighton	IA	161
Leland	IA	285
Lenox	IA	1385
Leon	IA	1903
Lester	IA	294
Letts	IA	377
Lewis	IA	416
Libertyville	IA	333
Lidderdale	IA	176
Lime Springs	IA	490
Lincoln	IA	157
Linden	IA	210
Lineville	IA	219
Linn Grove	IA	154
Lisbon	IA	2202
Liscomb	IA	304
Little Cedar	IA	60
Little Rock	IA	441
Little Sioux	IA	162
Littleport	IA	24
Livermore	IA	366
Lockridge	IA	283
Logan	IA	1465
Lohrville	IA	350
Lone Rock	IA	146
Lone Tree	IA	1415
Long Grove	IA	844
Lorimor	IA	349
Lost Nation	IA	424
Loveland	IA	35
Lovilia	IA	519
Low Moor	IA	279
Lowden	IA	770
Lowell	IA	0
Lu Verne	IA	255
Luana	IA	276
Lucas	IA	213
Luther	IA	123
Luxemburg	IA	252
Luzerne	IA	96
Lynnville	IA	390
Lytton	IA	301
Macedonia	IA	245
Macksburg	IA	111
Madrid	IA	2588
Magnolia	IA	174
Maharishi Vedic	IA	0
Maharishi Vedic City	IA	1299
Malcom	IA	278
Mallard	IA	267
Maloy	IA	29
Malvern	IA	1117
Manchester	IA	5073
Manilla	IA	775
Manly	IA	1310
Manning	IA	1472
Manson	IA	1615
Mapleton	IA	1214
Maquoketa	IA	5989
Marathon	IA	239
Marble Rock	IA	301
Marcus	IA	1070
Marengo	IA	2513
Marion	IA	37330
Marne	IA	116
Marquette	IA	451
Marshalltown	IA	27620
Martelle	IA	254
Martensdale	IA	472
Martinsburg	IA	110
Marysville	IA	66
Mason	IA	0
Mason City	IA	27366
Masonville	IA	124
Massena	IA	348
Matlock	IA	88
Maurice	IA	280
Maxwell	IA	923
Maynard	IA	499
Maysville	IA	180
McCallsburg	IA	335
McCausland	IA	314
McClelland	IA	151
McGregor	IA	839
McIntire	IA	121
Mechanicsville	IA	1108
Mediapolis	IA	1574
Melbourne	IA	827
Melcher-Dallas	IA	1259
Melrose	IA	110
Melvin	IA	206
Menlo	IA	343
Meriden	IA	150
Merrill	IA	733
Meservey	IA	248
Meyer	IA	31
Middle Amana	IA	581
Middletown	IA	338
Miles	IA	439
Milford	IA	3018
Miller	IA	60
Millersburg	IA	159
Millerton	IA	45
Millville	IA	30
Milo	IA	772
Milton	IA	413
Minburn	IA	384
Minden	IA	594
Mineola	IA	166
Mingo	IA	301
Missouri Valley	IA	2695
Mitchell	IA	137
Mitchellville	IA	2304
Modale	IA	262
Mona	IA	34
Mondamin	IA	374
Moneta	IA	29
Monmouth	IA	151
Monona	IA	1500
Monroe	IA	1831
Montezuma	IA	1411
Monticello	IA	3825
Montour	IA	247
Montpelier	IA	0
Montrose	IA	885
Mooar	IA	0
Moorhead	IA	218
Moorland	IA	164
Moravia	IA	643
Morley	IA	114
Morning Sun	IA	821
Morrison	IA	93
Moscow	IA	290
Moulton	IA	585
Mount Auburn	IA	148
Mount Ayr	IA	1686
Mount Pleasant	IA	8433
Mount Sterling	IA	36
Mount Union	IA	107
Mount Vernon	IA	4486
Moville	IA	1634
Murray	IA	735
Muscatine	IA	23968
Mystic	IA	411
Nashua	IA	1621
Nemaha	IA	83
Neola	IA	862
Nevada	IA	6831
New Albin	IA	496
New Hampton	IA	3452
New Hartford	IA	508
New Haven	IA	91
New Liberty	IA	142
New London	IA	1882
New Market	IA	408
New Providence	IA	227
New Sharon	IA	1291
New Vienna	IA	424
New Virginia	IA	485
Newell	IA	871
Newhall	IA	850
Newton	IA	15125
Nichols	IA	372
Nodaway	IA	108
Nora Springs	IA	1389
North Buena Vista	IA	113
North English	IA	1022
North Liberty	IA	15931
North Washington	IA	115
Northboro	IA	57
Northwood	IA	1995
Norwalk	IA	10135
Norway	IA	526
Numa	IA	90
Oak Hills	IA	0
Oakland	IA	1507
Oakland Acres	IA	156
Oakville	IA	170
Ocheyedan	IA	466
Odebolt	IA	978
Oelwein	IA	6153
Ogden	IA	2041
Okoboji	IA	818
Olds	IA	234
Olin	IA	688
Ollie	IA	210
Onawa	IA	2881
Oneida	IA	49
Onslow	IA	196
Orange	IA	0
Orange City	IA	6198
Orchard	IA	70
Orient	IA	379
Orleans	IA	614
Osage	IA	3654
Osceola	IA	4972
Oskaloosa	IA	11607
Ossian	IA	819
Osterdock	IA	57
Otho	IA	524
Oto	IA	108
Otranto	IA	27
Ottosen	IA	37
Ottumwa	IA	24624
Owasa	IA	43
Oxford	IA	825
Oxford Junction	IA	484
Oyens	IA	101
Pacific Junction	IA	457
Packwood	IA	215
Palmer	IA	160
Palo	IA	1053
Panama	IA	218
Panora	IA	1085
Panorama Park	IA	144
Park View	IA	2389
Parkersburg	IA	1960
Parnell	IA	220
Paton	IA	229
Patterson	IA	161
Paullina	IA	1017
Pella	IA	10363
Peosta	IA	1618
Percival	IA	87
Perry	IA	8089
Persia	IA	299
Peterson	IA	318
Pierson	IA	357
Pilot Mound	IA	175
Pioneer	IA	22
Pisgah	IA	239
Plainfield	IA	425
Plainview	IA	0
Plano	IA	69
Pleasant Hill	IA	9314
Pleasant Plain	IA	98
Pleasanton	IA	46
Pleasantville	IA	1669
Plover	IA	74
Plymouth	IA	373
Pocahontas	IA	1740
Polk	IA	0
Polk City	IA	4323
Pomeroy	IA	625
Popejoy	IA	77
Portland	IA	35
Portsmouth	IA	190
Postville	IA	2131
Prairie	IA	0
Prairie City	IA	1709
Prairieburg	IA	179
Prescott	IA	246
Preston	IA	1012
Primghar	IA	879
Princeton	IA	929
Promise	IA	0
Promise City	IA	112
Protivin	IA	279
Pulaski	IA	275
Quasqueton	IA	547
Quimby	IA	303
Radcliffe	IA	538
Rake	IA	221
Ralston	IA	75
Randalia	IA	66
Randall	IA	169
Randolph	IA	155
Rathbun	IA	87
Raymond	IA	816
Readlyn	IA	826
Reasnor	IA	153
Red Oak	IA	5472
Redding	IA	81
Redfield	IA	873
Reinbeck	IA	1639
Rembrandt	IA	204
Remsen	IA	1632
Renwick	IA	235
Rhodes	IA	308
Riceville	IA	810
Richland	IA	562
Rickardsville	IA	181
Ricketts	IA	142
Ridgeway	IA	309
Rinard	IA	52
Ringsted	IA	392
Rippey	IA	283
River Sioux	IA	59
Riverdale	IA	413
Riverside	IA	1045
Riverton	IA	282
Robins	IA	3454
Rochester	IA	133
Rock Falls	IA	152
Rock Rapids	IA	2602
Rock Valley	IA	3693
Rockford	IA	844
Rockwell	IA	1019
Rockwell City	IA	2141
Rodman	IA	44
Rodney	IA	58
Roland	IA	1304
Rolfe	IA	559
Rome	IA	117
Rose Hill	IA	167
Roseville	IA	49
Rossie	IA	71
Rowan	IA	155
Rowley	IA	267
Royal	IA	427
Rudd	IA	361
Runnells	IA	516
Russell	IA	537
Ruthven	IA	704
Rutland	IA	126
Ryan	IA	362
Sabula	IA	552
Sac	IA	0
Sac City	IA	2144
Sageville	IA	103
Saint Ansgar	IA	1107
Saint Anthony	IA	102
Saint Benedict	IA	39
Saint Charles	IA	653
Saint Donatus	IA	135
Saint Joseph	IA	61
Saint Lucas	IA	143
Saint Marys	IA	127
Saint Olaf	IA	108
Saint Paul	IA	129
Salem	IA	376
Salix	IA	380
Sanborn	IA	1385
Sandusky	IA	0
Sandyville	IA	51
Saylorville	IA	3301
Scarville	IA	71
Schaller	IA	745
Schleswig	IA	881
Scranton	IA	530
Searsboro	IA	143
Sergeant Bluff	IA	4520
Sexton	IA	37
Seymour	IA	696
Shambaugh	IA	186
Shannon	IA	0
Shannon City	IA	70
Sharpsburg	IA	88
Sheffield	IA	1140
Shelby	IA	618
Sheldahl	IA	320
Sheldon	IA	5088
Shell Rock	IA	1323
Shellsburg	IA	951
Shenandoah	IA	5021
Sherrill	IA	176
Shueyville	IA	672
Sibley	IA	2668
Sidney	IA	1044
Sigourney	IA	2005
Silver	IA	0
Silver City	IA	243
Sioux	IA	0
Sioux Center	IA	7461
Sioux City	IA	82821
Sioux Rapids	IA	777
Slater	IA	1506
Sloan	IA	979
Smithland	IA	225
Soldier	IA	168
Solon	IA	2545
Somers	IA	109
South Amana	IA	159
South English	IA	207
Spencer	IA	11212
Sperry	IA	0
Spillville	IA	355
Spirit Lake	IA	5018
Spragueville	IA	81
Spring Hill	IA	63
Springbrook	IA	140
Springville	IA	1139
St. Ansgar	IA	0
St. Anthony	IA	0
St. Benedict	IA	0
St. Charles	IA	0
St. Donatus	IA	0
St. Joseph	IA	0
St. Lucas	IA	0
St. Marys	IA	0
St. Olaf	IA	0
St. Paul	IA	0
Stacyville	IA	473
Stanhope	IA	412
Stanley	IA	125
Stanton	IA	639
Stanwood	IA	662
State Center	IA	1470
Steamboat Rock	IA	309
Stockport	IA	293
Stockton	IA	197
Stone	IA	0
Stone City	IA	192
Storm Lake	IA	10910
Story	IA	0
Story City	IA	3438
Stout	IA	223
Stratford	IA	725
Strawberry Point	IA	1236
Struble	IA	77
Stuart	IA	1602
Sully	IA	822
Sumner	IA	2009
Sun Valley Lake	IA	0
Superior	IA	129
Sutherland	IA	618
Swaledale	IA	160
Swan	IA	72
Swea	IA	0
Swea City	IA	521
Swedesburg	IA	0
Swisher	IA	943
Tabor	IA	979
Tama	IA	2819
Templeton	IA	348
Tennant	IA	66
Terril	IA	364
Thayer	IA	56
Thompson	IA	487
Thor	IA	181
Thornburg	IA	61
Thornton	IA	408
Thurman	IA	214
Tiffin	IA	2657
Tingley	IA	182
Tipton	IA	3200
Titonka	IA	452
Toeterville	IA	48
Toledo	IA	2202
Toronto	IA	120
Traer	IA	1655
Trenton	IA	0
Treynor	IA	952
Tripoli	IA	1342
Truesdale	IA	81
Truro	IA	483
Turin	IA	66
Twin Lakes	IA	334
Udell	IA	46
Underwood	IA	940
Union	IA	386
Unionville	IA	100
University Heights	IA	1119
University Park	IA	477
Urbana	IA	1459
Urbandale	IA	44062
Ute	IA	353
Vail	IA	424
Valeria	IA	57
Van Horne	IA	664
Van Meter	IA	1142
Van Wert	IA	215
Varina	IA	69
Ventura	IA	718
Victor	IA	888
Villisca	IA	1194
Vincent	IA	169
Vining	IA	50
Vinton	IA	5148
Volga	IA	205
Wadena	IA	253
Wahpeton	IA	343
Walcott	IA	1636
Walford	IA	1459
Walker	IA	792
Wall Lake	IA	795
Wallingford	IA	187
Walnut	IA	776
Wapello	IA	2041
Washburn	IA	876
Washington	IA	7408
Washta	IA	237
Waterloo	IA	68460
Waterville	IA	139
Watkins	IA	118
Waucoma	IA	257
Waukee	IA	18990
Waukon	IA	3736
Waverly	IA	10066
Wayland	IA	969
Webb	IA	138
Webster	IA	72
Webster City	IA	7814
Weldon	IA	119
Wellman	IA	1431
Wellsburg	IA	707
Welton	IA	160
Wesley	IA	381
West Amana	IA	135
West Bend	IA	759
West Branch	IA	2337
West Burlington	IA	3047
West Chester	IA	149
West Des Moines	IA	64113
West Liberty	IA	3728
West Okoboji	IA	295
West Point	IA	962
West Union	IA	2409
Westfield	IA	188
Westgate	IA	203
Weston	IA	92
Westphalia	IA	126
Westside	IA	299
Westwood	IA	112
Wever	IA	0
What Cheer	IA	622
Wheatland	IA	733
Whiting	IA	753
Whittemore	IA	492
Whitten	IA	149
Willey	IA	101
Williams	IA	335
Williamsburg	IA	3195
Williamson	IA	160
Wilton	IA	2805
Windsor Heights	IA	4889
Winfield	IA	1142
Winterset	IA	5176
Winthrop	IA	849
Wiota	IA	112
Woden	IA	223
Woodbine	IA	1422
Woodburn	IA	200
Woodward	IA	1503
Woolstock	IA	163
Worthington	IA	411
Wyoming	IA	511
Yale	IA	244
Yarmouth	IA	0
Yetter	IA	33
Yorktown	IA	83
Zearing	IA	537
Zwingle	IA	90
Aberdeen	ID	1929
Acequia	ID	124
Albion	ID	273
American Falls	ID	4321
Ammon	ID	14960
Arbon Valley	ID	599
Arco	ID	857
Arimo	ID	357
Ashton	ID	1051
Athol	ID	696
Atomic City	ID	28
Avery	ID	25
Avimor	ID	0
Bancroft	ID	367
Banks	ID	17
Basalt	ID	386
Bellevue	ID	2300
Bennington	ID	190
Blackfoot	ID	11740
Blanchard	ID	261
Bliss	ID	305
Bloomington	ID	207
Boise	ID	235684
Bonners Ferry	ID	2549
Bovill	ID	253
Bruneau	ID	0
Buhl	ID	4275
Burley	ID	10436
Butte	ID	0
Butte City	ID	64
Caldwell	ID	51686
Cambridge	ID	313
Carey	ID	602
Cascade	ID	938
Castleford	ID	226
Challis	ID	1043
Chatcolet	ID	76
Chubbuck	ID	14428
Clark Fork	ID	541
Clayton	ID	6
Clifton	ID	286
Coeur d'Alene	ID	49122
Conda	ID	21260
Conkling Park	ID	43
Coolin	ID	0
Cottonwood	ID	921
Council	ID	808
Craigmont	ID	493
Crouch	ID	161
Culdesac	ID	377
Dalton Gardens	ID	2386
Dayton	ID	465
De Smet	ID	175
Deary	ID	508
Declo	ID	353
Dietrich	ID	335
Donnelly	ID	147
Dover	ID	660
Downey	ID	616
Driggs	ID	1689
Drummond	ID	15
Dubois	ID	606
Eagle	ID	23612
Eagle Foothills	ID	30000
East Hope	ID	216
Eden	ID	405
Elk	ID	0
Elk City	ID	202
Elk River	ID	119
Emmett	ID	6604
Fairfield	ID	389
Ferdinand	ID	161
Fernan Lake	ID	0
Fernan Lake Village	ID	173
Fernwood	ID	0
Filer	ID	2691
Firth	ID	467
Fort Hall	ID	3201
Franklin	ID	769
Freedom	ID	214
Fruitland	ID	5087
Gannett	ID	0
Garden	ID	0
Garden City	ID	11550
Garden Valley	ID	394
Genesee	ID	955
Georgetown	ID	467
Glenns Ferry	ID	1229
Gooding	ID	3509
Grace	ID	897
Grand View	ID	443
Grangeville	ID	3155
Greenleaf	ID	882
Grouse	ID	29
Groveland	ID	877
Hagerman	ID	867
Hailey	ID	8134
Hamer	ID	51
Hammett	ID	0
Hansen	ID	1249
Harrison	ID	216
Hauser	ID	689
Hayden	ID	14133
Hayden Lake	ID	599
Hazelton	ID	741
Heyburn	ID	3223
Hidden Spring	ID	2280
Hidden Springs	ID	0
Hollister	ID	276
Homedale	ID	2565
Hope	ID	88
Horseshoe Bend	ID	688
Huetter	ID	102
Idaho	ID	0
Idaho City	ID	474
Idaho Falls	ID	59184
Inkom	ID	870
Iona	ID	2056
Irwin	ID	224
Island Park	ID	272
Jerome	ID	11184
Juliaetta	ID	578
Kamiah	ID	1273
Kellogg	ID	2069
Kendrick	ID	298
Ketchum	ID	2728
Kimberly	ID	3610
Kooskia	ID	606
Kootenai	ID	789
Kuna	ID	17226
Laclede	ID	0
Lapwai	ID	1147
Lava Hot Springs	ID	407
Leadore	ID	102
Letha	ID	0
Lewiston	ID	32544
Lewiston Orchards	ID	31422
Lewisville	ID	478
Lincoln	ID	3647
Lost River	ID	68
Lowman	ID	42
Mackay	ID	476
Malad	ID	0
Malad City	ID	2050
Malta	ID	198
Marsing	ID	1287
McCall	ID	3106
McCammon	ID	797
Melba	ID	531
Menan	ID	754
Meridian	ID	90739
Middleton	ID	6828
Midvale	ID	165
Minidoka	ID	112
Montpelier	ID	2509
Moore	ID	164
Moreland	ID	1278
Moscow	ID	25060
Mountain Home	ID	13730
Mountain Home AFB	ID	0
Moyie Springs	ID	717
Mud Lake	ID	372
Mullan	ID	675
Murphy	ID	97
Murtaugh	ID	124
Nampa	ID	89839
New Meadows	ID	471
New Plymouth	ID	1503
Newdale	ID	307
Nezperce	ID	468
Notus	ID	546
Oakley	ID	790
Oldtown	ID	181
Onaway	ID	189
Orofino	ID	3054
Osburn	ID	1510
Oxford	ID	47
Paris	ID	506
Parker	ID	298
Parkline	ID	71
Parma	ID	2082
Paul	ID	1192
Payette	ID	7380
Peck	ID	201
Pierce	ID	487
Pinehurst	ID	1580
Placerville	ID	53
Plummer	ID	1019
Pocatello	ID	54441
Ponderay	ID	1138
Post Falls	ID	30453
Potlatch	ID	805
Preston	ID	5212
Priest River	ID	1758
Princeton	ID	148
Rathdrum	ID	7538
Reubens	ID	71
Rexburg	ID	27663
Richfield	ID	486
Rigby	ID	4029
Riggins	ID	418
Ririe	ID	637
Riverside	ID	838
Roberts	ID	573
Robie Creek	ID	0
Rockford	ID	276
Rockford Bay	ID	184
Rockland	ID	290
Rupert	ID	5705
Saint Anthony	ID	3542
Saint Charles	ID	131
Saint Maries	ID	2402
Salmon	ID	3036
Sandpoint	ID	7835
Santa	ID	352
Shelley	ID	4339
Shoshone	ID	1488
Silverton	ID	0
Smelterville	ID	603
Smiths Ferry	ID	75
Soda Springs	ID	2944
Spencer	ID	33
Spirit Lake	ID	2086
St. Anthony	ID	0
St. Charles	ID	0
St. Maries	ID	0
Stanley	ID	68
Star	ID	7797
State Line	ID	0
State Line Village	ID	31
Stites	ID	222
Sugar	ID	0
Sugar City	ID	1328
Sun Valley	ID	1422
Swan Valley	ID	221
Sweetwater	ID	143
Tensed	ID	120
Teton	ID	709
Tetonia	ID	278
Troy	ID	880
Twin Falls	ID	47468
Tyhee	ID	1123
Ucon	ID	1132
Victor	ID	1961
Viola	ID	0
Wallace	ID	761
Wardner	ID	186
Warm River	ID	3
Weippe	ID	406
Weiser	ID	5317
Wendell	ID	2744
Weston	ID	450
White Bird	ID	93
Wilder	ID	1622
Winchester	ID	339
Worley	ID	256
Yellow Pine	ID	32
Abingdon	IL	3182
Adair	IL	210
Adams	IL	0
Addieville	IL	243
Addison	IL	37208
Adeline	IL	82
Albany	IL	890
Albany Park	IL	52079
Albers	IL	1174
Albion	IL	1932
Alden	IL	0
Aledo	IL	3564
Alexander	IL	0
Alexis	IL	809
Algonquin	IL	30571
Alhambra	IL	661
Allendale	IL	460
Allenville	IL	146
Allerton	IL	287
Alma	IL	315
Alorton	IL	1933
Alpha	IL	648
Alsey	IL	217
Alsip	IL	19346
Altamont	IL	2308
Alto Pass	IL	382
Alton	IL	27003
Altona	IL	511
Alvan (Alvin)	IL	0
Alvin	IL	316
Amboy	IL	2356
Anchor	IL	146
Andalusia	IL	1182
Andover	IL	573
Andres	IL	0
Anna	IL	4321
Annapolis	IL	55
Annawan	IL	858
Antioch	IL	14329
Apple Canyon Lake	IL	558
Apple River	IL	356
Arbury Hills	IL	0
Arcola	IL	2884
Arenzville	IL	389
Argenta	IL	912
Argyle	IL	0
Arlington	IL	186
Arlington Heights	IL	75926
Armington	IL	335
Aroma Park	IL	712
Arrowsmith	IL	293
Arthur	IL	2288
Ashburn	IL	42752
Ashkum	IL	737
Ashland	IL	1256
Ashley	IL	507
Ashmore	IL	766
Ashton	IL	916
Assumption	IL	1116
Astoria	IL	1086
Athens	IL	1938
Atkinson	IL	948
Atlanta	IL	1648
Atwood	IL	1191
Auburn	IL	4793
Auburn Gresham	IL	45842
Augusta	IL	566
Aurora	IL	200661
Ava	IL	637
Aviston	IL	2084
Avon	IL	757
Avondale	IL	39721
Baileyville	IL	0
Baldwin	IL	349
Banner	IL	181
Bannockburn	IL	1571
Bardolph	IL	242
Barrington	IL	10353
Barrington Hills	IL	4251
Barry	IL	1274
Barstow	IL	0
Bartelso	IL	601
Bartlett	IL	41545
Bartonville	IL	6382
Basco	IL	96
Batavia	IL	26495
Batchtown	IL	206
Bath	IL	306
Bay View Garden	IL	378
Bay View Gardens	IL	0
Baylis	IL	200
Beach Park	IL	13976
Beardstown	IL	5738
Beason	IL	189
Beaverville	IL	345
Beckemeyer	IL	1016
Bedford Park	IL	577
Beecher	IL	4450
Beecher City	IL	456
Belgium	IL	404
Belknap	IL	105
Belle Prairie	IL	0
Belle Prairie City	IL	53
Belle Rive	IL	359
Belleville	IL	42034
Bellevue	IL	1954
Bellflower	IL	349
Bellmont	IL	270
Bellwood	IL	19308
Belmont Cragin	IL	79159
Belvidere	IL	25132
Bement	IL	1683
Benld	IL	1488
Bensenville	IL	18440
Benson	IL	428
Bentley	IL	34
Benton	IL	7041
Berkeley	IL	5203
Berlin	IL	179
Berwyn	IL	56368
Bethalto	IL	9349
Bethany	IL	1322
Beverly	IL	0
Big Foot Prairie	IL	65
Big Rock	IL	1165
Biggsville	IL	291
Bingham	IL	83
Birds	IL	52
Bishop Hill	IL	126
Bismarck	IL	555
Blairsville	IL	0
Blandinsville	IL	620
Bloomfield	IL	0
Bloomingdale	IL	22254
Bloomington	IL	78292
Blue Island	IL	23652
Blue Mound	IL	1111
Bluffs	IL	677
Bluford	IL	673
Bolingbrook	IL	74306
Bondville	IL	442
Bone Gap	IL	242
Bonfield	IL	373
Bonnie	IL	385
Bonnie Brae	IL	0
Boody	IL	276
Boulder Hill	IL	8108
Bourbonnais	IL	18569
Bowen	IL	478
Braceville	IL	769
Bradford	IL	736
Bradley	IL	15617
Braidwood	IL	6172
Breese	IL	4506
Bridgeport	IL	33878
Bridgeview	IL	16407
Brighton	IL	2198
Brighton Park	IL	44202
Brimfield	IL	854
Broadlands	IL	356
Broadview	IL	7918
Broadwell	IL	142
Brocton	IL	301
Brookfield	IL	18944
Brooklyn	IL	715
Brookport	IL	930
Broughton	IL	190
Browning	IL	128
Browns	IL	132
Brownstown	IL	747
Brussels	IL	136
Bryant	IL	213
Buckingham	IL	293
Buckley	IL	569
Buckner	IL	451
Buda	IL	519
Buffalo	IL	490
Buffalo Grove	IL	41496
Buffalo Prairie	IL	0
Bull Valley	IL	1104
Bulpitt	IL	215
Buncombe	IL	204
Bunker Hill	IL	1716
Burbank	IL	29128
Bureau	IL	360
Bureau Junction	IL	0
Burlington	IL	637
Burnham	IL	4210
Burnt Prairie	IL	52
Burr Ridge	IL	10818
Burton	IL	0
Burtons Bridge	IL	0
Bush	IL	274
Bushnell	IL	2976
Butler	IL	175
Byron	IL	3648
Cabery	IL	258
Cable	IL	0
Cache	IL	7
Cahokia	IL	14402
Cahokia Heights	IL	0
Cairo	IL	1733
Caledonia	IL	195
Calhoun	IL	164
Calumet	IL	0
Calumet City	IL	37031
Calumet Park	IL	7865
Camargo	IL	446
Cambria	IL	1265
Cambridge	IL	2113
Camden	IL	81
Cameron	IL	0
Camp Point	IL	1125
Campbell Hill	IL	324
Campbell's Island	IL	0
Campton Hills	IL	0
Campus	IL	160
Candlewick Lake	IL	0
Canton	IL	14211
Cantrall	IL	139
Capron	IL	1348
Carbon Cliff	IL	2037
Carbon Hill	IL	347
Carbondale	IL	26399
Carlinville	IL	5665
Carlock	IL	555
Carlyle	IL	3224
Carman	IL	0
Carmi	IL	5119
Carol Stream	IL	40356
Carpentersville	IL	38512
Carrier Mills	IL	1625
Carrollton	IL	2429
Carterville	IL	5818
Carthage	IL	2545
Cary	IL	17965
Casey	IL	2709
Caseyville	IL	4045
Catlin	IL	2007
Cave-in-Rock	IL	318
Cedar Point	IL	269
Cedarville	IL	716
Central	IL	0
Central City	IL	1359
Centralia	IL	12655
Centreville	IL	5027
Cerro Gordo	IL	1353
Chadwick	IL	526
Champaign	IL	86096
Chandlerville	IL	523
Channahon	IL	12594
Channel Lake	IL	1664
Chapin	IL	575
Charleston	IL	21196
Chatham	IL	31392
Chatsworth	IL	1151
Chebanse	IL	1023
Chemung	IL	308
Chenoa	IL	1763
Cherry	IL	465
Cherry Valley	IL	3098
Chester	IL	8588
Chesterfield	IL	182
Chestnut	IL	246
Chicago	IL	2664452
Chicago Heights	IL	30284
Chicago Lawn	IL	55551
Chicago Loop	IL	33442
Chicago Ridge	IL	14373
Chillicothe	IL	6226
Chrisman	IL	1272
Christopher	IL	2779
Cicero	IL	83886
Cisco	IL	255
Cisne	IL	659
Cissna Park	IL	812
Claremont	IL	175
Clarendon Hills	IL	8676
Clay	IL	0
Clay City	IL	929
Clayton	IL	745
Clear Lake	IL	228
Cleveland	IL	185
Clifton	IL	1410
Clinton	IL	7048
Coal	IL	0
Coal City	IL	5489
Coal Valley	IL	3748
Coalton	IL	295
Coatsburg	IL	146
Cobden	IL	1139
Coello	IL	553
Coffeen	IL	665
Colchester	IL	1337
Coleta	IL	160
Colfax	IL	1046
Collinsville	IL	24754
Colona	IL	5100
Colp	IL	224
Columbia	IL	10191
Columbus	IL	99
Como	IL	567
Compton	IL	287
Concord	IL	165
Congerville	IL	497
Cooksville	IL	184
Coral	IL	0
Cordova	IL	660
Cornell	IL	447
Cornland	IL	93
Cortland	IL	4325
Coulterville	IL	913
Country Club Hills	IL	16795
Countryside	IL	6002
Cowden	IL	583
Coyne Center	IL	827
Crab Orchard	IL	333
Crainville	IL	1381
Creal Springs	IL	532
Crescent	IL	0
Crescent City	IL	598
Crest Hill	IL	21153
Creston	IL	649
Crestwood	IL	10984
Crete	IL	8191
Creve Coeur	IL	5272
Crossville	IL	724
Crystal Lake	IL	40448
Crystal Lawns	IL	1872
Cuba	IL	1361
Cullom	IL	529
Curran	IL	211
Custer Park	IL	0
Cutler	IL	422
Cypress	IL	236
Dahlgren	IL	506
Dakota	IL	478
Dallas	IL	0
Dallas City	IL	910
Dalton	IL	0
Dalton City	IL	527
Dalzell	IL	681
Damiansville	IL	495
Dana	IL	155
Danforth	IL	578
Danvers	IL	1137
Danville	IL	32108
Darien	IL	22256
Darmstadt	IL	68
Davis	IL	642
Davis Junction	IL	2270
Dawson	IL	496
Dayton	IL	537
De Land	IL	424
De Pue	IL	0
De Soto	IL	1575
De Witt	IL	0
Decatur	IL	73254
Deer Creek	IL	682
Deer Grove	IL	47
Deer Park	IL	3759
Deerfield	IL	19019
DeKalb	IL	43211
Delavan	IL	1633
Depue	IL	1838
Des Plaines	IL	58677
Detroit	IL	81
Dewey	IL	0
DeWitt	IL	181
Diamond	IL	2488
Dieterich	IL	609
Divernon	IL	1156
Dix	IL	457
Dixmoor	IL	3597
Dixon	IL	15319
Dolton	IL	23197
Dongola	IL	712
Donnellson	IL	205
Donovan	IL	298
Dorchester	IL	146
Douglas	IL	20323
Dover	IL	162
Dowell	IL	392
Downers Grove	IL	49732
Downs	IL	988
Du Bois	IL	199
Du Quoin	IL	5949
Dundas	IL	0
Dunfermline	IL	288
Dunlap	IL	1417
Dupo	IL	3921
Durand	IL	1409
Dwight	IL	4063
Eagarville	IL	0
Eagerville	IL	127
Eagle Lake	IL	0
Earlville	IL	1632
East Alton	IL	6176
East Brooklyn	IL	104
East Cape Girardeau	IL	331
East Carondelet	IL	473
East Dubuque	IL	1658
East Dundee	IL	3200
East Galesburg	IL	796
East Garfield Park	IL	20656
East Gillespie	IL	270
East Hazel Crest	IL	1545
East Lynn	IL	0
East Moline	IL	21350
East Peoria	IL	23080
East Pierron	IL	200
East Saint Louis	IL	27006
East St. Louis	IL	0
Easton	IL	302
Eddyville	IL	95
Edgewater	IL	54873
Edgewood	IL	531
Edgington	IL	0
Edinburg	IL	1051
Edwardsville	IL	24992
Effingham	IL	12604
El Dara	IL	76
El Paso	IL	2798
Elburn	IL	5748
Eldorado	IL	4064
Eldred	IL	194
Elgin	IL	112111
Eliza	IL	0
Elizabeth	IL	749
Elizabethtown	IL	287
Elk Grove	IL	0
Elk Grove Village	IL	33238
Elkhart	IL	396
Elkville	IL	904
Elliott	IL	285
Ellis Grove	IL	353
Ellisville	IL	92
Ellsworth	IL	194
Elmhurst	IL	45957
Elmwood	IL	2089
Elmwood Park	IL	24840
Elsah	IL	632
Elvaston	IL	161
Elwin	IL	0
Elwood	IL	2258
Emden	IL	474
Emington	IL	113
Energy	IL	1145
Enfield	IL	580
Englewood	IL	26121
Equality	IL	556
Erie	IL	1553
Essex	IL	770
Eureka	IL	5377
Evanston	IL	75527
Evansville	IL	675
Evergreen Park	IL	19841
Ewing	IL	304
Exeter	IL	62
Fairbury	IL	3630
Fairfield	IL	5255
Fairmont	IL	2459
Fairmont City	IL	2502
Fairmount	IL	620
Fairview	IL	489
Fairview Heights	IL	16827
Fall Creek	IL	0
Farina	IL	512
Farmer	IL	0
Farmer City	IL	2004
Farmersville	IL	703
Farmington	IL	2460
Fayetteville	IL	343
Ferris	IL	152
Fidelity	IL	109
Fieldon	IL	228
Fillmore	IL	321
Findlay	IL	653
Fisher	IL	1959
Fithian	IL	471
Flanagan	IL	1082
Flat Rock	IL	325
Flora	IL	4944
Floraville	IL	53
Florence	IL	68
Flossmoor	IL	9478
Foosland	IL	102
Ford Heights	IL	2773
Forest	IL	0
Forest City	IL	232
Forest Lake	IL	1659
Forest Park	IL	14123
Forest View	IL	692
Forrest	IL	1177
Forreston	IL	1377
Forsyth	IL	3584
Fowler	IL	0
Fox Lake	IL	10518
Fox Lake Hills	IL	2591
Fox River Grove	IL	4686
Frankfort	IL	18653
Frankfort Square	IL	9276
Franklin	IL	597
Franklin Grove	IL	967
Franklin Park	IL	18312
Franklinville	IL	0
Freeburg	IL	4241
Freeman Spur	IL	291
Freeport	IL	24476
Fulton	IL	3369
Fults	IL	26
Future City	IL	17
Gage Park	IL	41202
Gages Lake	IL	10198
Galatia	IL	917
Galena	IL	3299
Galesburg	IL	31273
Galt	IL	0
Galva	IL	2517
Garden Prairie	IL	352
Gardner	IL	1434
Garrett	IL	162
Gays	IL	277
Geff	IL	310
Geneseo	IL	6538
Geneva	IL	21806
Genoa	IL	5196
Georgetown	IL	3493
German Valley	IL	450
Germantown	IL	1285
Germantown Hills	IL	3508
Gibson	IL	0
Gibson City	IL	3409
Gifford	IL	1092
Gilberts	IL	7638
Gillespie	IL	3176
Gilman	IL	1754
Gilson	IL	190
Girard	IL	2027
Gladstone	IL	278
Glasford	IL	1003
Glasgow	IL	135
Glen Carbon	IL	12966
Glen Ellyn	IL	28201
Glencoe	IL	8945
Glendale Heights	IL	34208
Glenview	IL	47446
Glenwood	IL	8996
Godfrey	IL	17759
Godley	IL	681
Golconda	IL	629
Golden	IL	637
Golden Gate	IL	68
Golf	IL	504
Good Hope	IL	382
Goodenow	IL	0
Goodfield	IL	945
Goodings Grove	IL	18569
Goofy Ridge	IL	350
Goreville	IL	1062
Gorham	IL	233
Grafton	IL	653
Grand Boulevard	IL	22373
Grand Chain	IL	271
Grand Detour	IL	429
Grand Ridge	IL	532
Grand Tower	IL	588
Grandview	IL	1427
Grandwood Park	IL	5202
Granite	IL	0
Granite City	IL	29054
Grant Park	IL	1289
Grantfork	IL	328
Granville	IL	1318
Grayslake	IL	20915
Grayville	IL	1626
Greater Grand Crossing	IL	32346
Green Oaks	IL	3837
Green Rock	IL	2970
Green Valley	IL	685
Greenfield	IL	1020
Greenup	IL	1495
Greenview	IL	749
Greenville	IL	6666
Greenwood	IL	251
Gridley	IL	1439
Griggsville	IL	1176
Gulfport	IL	54
Gurnee	IL	31056
Hainesville	IL	3668
Hamburg	IL	123
Hamel	IL	806
Hamilton	IL	2853
Hamlet	IL	0
Hamletsburg	IL	90
Hammond	IL	483
Hampshire	IL	6130
Hampton	IL	1840
Hanaford	IL	0
Hanna	IL	0
Hanna City	IL	1232
Hanover	IL	814
Hanover Park	IL	38333
Hardin	IL	934
Harding	IL	0
Harmon	IL	120
Harmony	IL	0
Harrisburg	IL	8891
Harrison	IL	970
Harristown	IL	1332
Hartford	IL	1382
Hartland	IL	0
Hartsburg	IL	309
Harvard	IL	9194
Harvel	IL	216
Harvey	IL	25194
Harwood Heights	IL	8635
Havana	IL	3076
Hawthorn Woods	IL	7961
Hazel Crest	IL	14118
Hebron	IL	1202
Hecker	IL	488
Henderson	IL	309
Hennepin	IL	698
Henning	IL	246
Henry	IL	2327
Heritage Lake	IL	1520
Herrick	IL	424
Herrin	IL	12910
Herscher	IL	1554
Hettick	IL	174
Heyworth	IL	2890
Hickory Hills	IL	14122
Hidalgo	IL	105
Highland	IL	9848
Highland Park	IL	29743
Highwood	IL	5352
Hillcrest	IL	1280
Hillsboro	IL	5726
Hillsdale	IL	510
Hillside	IL	8155
Hillview	IL	186
Hinckley	IL	2058
Hindsboro	IL	307
Hinsdale	IL	17628
Hodgkins	IL	1868
Hoffman	IL	494
Hoffman Estates	IL	52138
Holcomb	IL	0
Holiday Hills	IL	592
Holiday Shores	IL	2882
Hollowayville	IL	81
Homer	IL	1198
Homer Glen	IL	24395
Hometown	IL	4342
Homewood	IL	19373
Hoopeston	IL	5220
Hooppole	IL	200
Hopedale	IL	843
Hopewell	IL	407
Hopkins Park	IL	605
Hoyleton	IL	510
Hudson	IL	1846
Huey	IL	166
Hull	IL	439
Humboldt	IL	430
Hume	IL	363
Huntley	IL	26005
Hurst	IL	797
Hutsonville	IL	545
Hyde Park	IL	26893
Illinois	IL	0
Illiopolis	IL	880
Ina	IL	2360
Indian Creek	IL	543
Indian Head Park	IL	3824
Indianola	IL	270
Industry	IL	457
Ingalls Park	IL	3314
Inverness	IL	7583
Iola	IL	138
Ipava	IL	443
Iroquois	IL	149
Irving	IL	481
Irving Park	IL	56520
Irvington	IL	636
Irwin	IL	72
Island Lake	IL	8080
Itasca	IL	8798
Iuka	IL	472
Ivesdale	IL	269
Jacksonville	IL	19103
Janesville	IL	0
Jeffersonville	IL	0
Jeisyville	IL	104
Jerome	IL	1651
Jerseyville	IL	8469
Jewett	IL	222
Johnsburg	IL	6310
Johnsonville	IL	76
Johnston	IL	0
Johnston City	IL	3500
Joliet	IL	147861
Jonesboro	IL	1768
Joppa	IL	347
Joslin	IL	0
Joy	IL	392
Junction	IL	122
Junction City	IL	462
Justice	IL	12968
Kampsville	IL	315
Kane	IL	418
Kaneville	IL	492
Kangley	IL	244
Kankakee	IL	26676
Kansas	IL	744
Kappa	IL	238
Karnak	IL	458
Kaskaskia	IL	13
Keenes	IL	82
Keensburg	IL	205
Keithsburg	IL	582
Kell	IL	215
Kempton	IL	223
Kenilworth	IL	2555
Kenney	IL	318
Kenwood	IL	17601
Kewanee	IL	12533
Keyesport	IL	401
Kilbourne	IL	284
Kildeer	IL	4040
Kincaid	IL	1437
Kinderhook	IL	210
Kings	IL	0
Kingston	IL	1155
Kingston Mines	IL	300
Kinmundy	IL	772
Kinsman	IL	98
Kirkland	IL	1734
Kirkwood	IL	704
Klondike	IL	54
Knollwood	IL	1747
Knoxville	IL	2836
La Clede	IL	0
La Fayette	IL	0
La Grange	IL	15723
La Grange Park	IL	13608
La Harpe	IL	1197
La Moille	IL	701
La Prairie	IL	47
La Rose	IL	137
La Salle	IL	9609
Lacon	IL	1826
Ladd	IL	1241
Lafayette	IL	223
Lake	IL	0
Lake Barrington	IL	4973
Lake Bluff	IL	5674
Lake Camelot	IL	1686
Lake Carroll	IL	0
Lake Catherine	IL	1379
Lake Forest	IL	19408
Lake Holiday	IL	4761
Lake in the Hills	IL	29024
Lake Ka-Ho	IL	222
Lake of the Woods	IL	2912
Lake Petersburg	IL	719
Lake Summerset	IL	2048
Lake Villa	IL	8821
Lake Zurich	IL	19993
Lakemoor	IL	6015
Lakewood	IL	3843
Lakewood Shores	IL	1347
Lanark	IL	1373
Lane	IL	0
Langleyville	IL	432
Lansing	IL	28349
LaPlace	IL	259
LaSalle	IL	0
Latham	IL	361
Lawrence	IL	0
Lawrenceville	IL	4427
Le Roy	IL	3582
Leaf River	IL	418
Lebanon	IL	4467
Lee	IL	327
Lee Center	IL	0
Leland	IL	943
Leland Grove	IL	1523
Lemont	IL	16788
Lena	IL	2800
Lenzburg	IL	492
Leonore	IL	126
Lerna	IL	282
Lewistown	IL	2261
Lexington	IL	2059
Liberty	IL	513
Libertyville	IL	20436
Lily Lake	IL	1032
Lima	IL	160
Limestone	IL	1563
Lincoln	IL	13966
Lincoln Park	IL	66959
Lincoln Square	IL	40761
Lincolnshire	IL	7282
Lincolnwood	IL	12646
Lindenhurst	IL	14408
Lisbon	IL	298
Lisle	IL	22964
Litchfield	IL	6897
Literberry	IL	0
Little York	IL	330
Littleton	IL	169
Liverpool	IL	124
Livingston	IL	827
Loami	IL	754
Lockport	IL	25175
Lockport Heights	IL	0
Loda	IL	399
Logan	IL	327
Logan Square	IL	73702
Lomax	IL	424
Lombard	IL	43797
London Mills	IL	381
Long Creek	IL	1302
Long Grove	IL	8166
Long Lake	IL	3515
Long Point	IL	218
Longview	IL	154
Loraine	IL	311
Lorenzo	IL	0
Lost Nation	IL	708
Lostant	IL	483
Louisville	IL	1116
Loves Park	IL	23455
Lovington	IL	1108
Lower West Side	IL	34410
Lowpoint	IL	0
Ludlow	IL	365
Lyndon	IL	626
Lynn Center	IL	0
Lynnville	IL	115
Lynwood	IL	9280
Lyons	IL	10722
Macedonia	IL	62
Machesney Park	IL	22927
Mackinaw	IL	1923
Macomb	IL	18547
Macon	IL	1131
Madison	IL	3868
Maeystown	IL	158
Magnolia	IL	252
Mahomet	IL	8056
Makanda	IL	545
Malden	IL	349
Malta	IL	1152
Manchester	IL	280
Manhattan	IL	7400
Manito	IL	1527
Manlius	IL	346
Mansfield	IL	870
Manteno	IL	8999
Maple Park	IL	1308
Mapleton	IL	281
Maquon	IL	283
Marcelline	IL	0
Marengo	IL	7503
Marietta	IL	107
Marine	IL	935
Marion	IL	17803
Marissa	IL	1856
Mark	IL	532
Markham	IL	12682
Marley	IL	0
Maroa	IL	1739
Marquette Heights	IL	2742
Marseilles	IL	4963
Marshall	IL	3880
Martinsville	IL	1135
Martinton	IL	373
Maryville	IL	7902
Mascoutah	IL	7975
Mason	IL	343
Mason City	IL	2180
Matherville	IL	684
Matteson	IL	19195
Mattoon	IL	18113
Maunie	IL	137
Maywood	IL	24012
Mazon	IL	989
McClure	IL	256
McCook	IL	230
McCullom Lake	IL	1021
McHenry	IL	26657
McKinley Park	IL	15612
McLean	IL	815
McLeansboro	IL	2792
McNabb	IL	264
Mechanicsburg	IL	629
Media	IL	102
Medinah	IL	2097
Medora	IL	405
Melrose Park	IL	25379
Melvin	IL	437
Mendon	IL	942
Mendota	IL	7204
Menominee	IL	249
Meredosia	IL	1018
Merrionette Park	IL	1886
Merritt	IL	0
Metamora	IL	3734
Metcalf	IL	181
Metropolis	IL	6334
Mettawa	IL	578
Meyer	IL	0
Middletown	IL	313
Midlothian	IL	14847
Milan	IL	5096
Milford	IL	1242
Mill Creek	IL	63
Mill Shoals	IL	212
Millbrook	IL	350
Milledgeville	IL	983
Millersburg	IL	0
Millington	IL	665
Millstadt	IL	3896
Milton	IL	264
Mineral	IL	229
Minier	IL	1224
Minonk	IL	2053
Minooka	IL	11243
Mitchell	IL	1356
Modesto	IL	183
Mokena	IL	19923
Moline	IL	42681
Momence	IL	3213
Monee	IL	5082
Monmouth	IL	9291
Monroe Center	IL	455
Montgomery	IL	19489
Monticello	IL	5509
Montrose	IL	200
Morgan Park	IL	22924
Moro	IL	0
Morris	IL	14363
Morrison	IL	4145
Morrisonville	IL	1028
Morton	IL	16306
Morton Grove	IL	23448
Mossville	IL	0
Mound	IL	0
Mound City	IL	544
Mound Station	IL	0
Mounds	IL	745
Mount Auburn	IL	462
Mount Carmel	IL	7027
Mount Carroll	IL	1620
Mount Clare	IL	269
Mount Erie	IL	87
Mount Greenwood	IL	18783
Mount Morris	IL	2877
Mount Olive	IL	2013
Mount Prospect	IL	54747
Mount Pulaski	IL	1515
Mount Sterling	IL	1968
Mount Vernon	IL	15087
Mount Zion	IL	5862
Moweaqua	IL	1751
Muddy	IL	69
Mulberry Grove	IL	598
Mulkeytown	IL	175
Muncie	IL	143
Mundelein	IL	31582
Murphysboro	IL	7768
Murrayville	IL	572
Nachusa	IL	0
Naperville	IL	147100
Naplate	IL	484
Naples	IL	125
Nashville	IL	3132
Nason	IL	235
National City	IL	53
Nauvoo	IL	1108
Near North Side	IL	85711
Near South Side	IL	22401
Nebo	IL	331
Nekoma	IL	0
Nelson	IL	162
Neoga	IL	1613
Neponset	IL	446
New Athens	IL	1951
New Baden	IL	3313
New Bedford	IL	72
New Berlin	IL	1350
New Boston	IL	653
New Burnside	IL	212
New Canton	IL	350
New City	IL	40997
New Douglas	IL	317
New Grand Chain	IL	195
New Haven	IL	404
New Holland	IL	263
New Lenox	IL	25800
New Milford	IL	697
New Minden	IL	207
New Salem	IL	133
New Windsor	IL	782
Newark	IL	1025
Newman	IL	854
Newton	IL	2814
Niantic	IL	673
Niles	IL	29876
Nilwood	IL	231
Niota	IL	0
Noble	IL	668
Nokomis	IL	2185
Nora	IL	114
Normal	IL	54373
Norridge	IL	14621
Norris	IL	204
Norris City	IL	1247
North	IL	0
North Aurora	IL	17456
North Barrington	IL	3022
North Center	IL	34623
North Chicago	IL	29491
North Henderson	IL	180
North Lawndale	IL	35276
North Pekin	IL	1569
North Peoria	IL	113004
North Riverside	IL	6665
North Utica	IL	0
Northbrook	IL	33663
Northfield	IL	5484
Northlake	IL	12312
Norwood	IL	475
O'Fallon	IL	29002
Oak Brook	IL	8091
Oak Forest	IL	28074
Oak Grove	IL	572
Oak Lawn	IL	56781
Oak Park	IL	52287
Oak Run	IL	547
Oakbrook Terrace	IL	2164
Oakdale	IL	213
Oakford	IL	279
Oakland	IL	881
Oakwood	IL	1532
Oakwood Hills	IL	2063
Oblong	IL	1427
Oconee	IL	176
Odell	IL	1000
Odin	IL	1040
Ogden	IL	806
Oglesby	IL	3647
Ohio	IL	495
Ohlman	IL	131
Okawville	IL	1399
Old Mill Creek	IL	224
Old Ripley	IL	103
Old Shawneetown	IL	178
Olive Branch	IL	650
Olivet	IL	428
Olmsted	IL	310
Olney	IL	9005
Olympia Fields	IL	4988
Omaha	IL	253
Onarga	IL	1321
Oneida	IL	681
Opdyke	IL	254
Ophiem	IL	0
Oquawka	IL	1314
Orangeville	IL	756
Oreana	IL	837
Oregon	IL	3580
Orient	IL	353
Orion	IL	1825
Orland Hills	IL	7249
Orland Park	IL	58619
Osco	IL	0
Oswego	IL	33955
Ottawa	IL	18342
Otterville	IL	120
Owaneco	IL	231
Oxville	IL	0
Paderborn	IL	43
Palatine	IL	69308
Palestine	IL	1331
Palmer	IL	222
Palmyra	IL	731
Paloma	IL	0
Palos Heights	IL	12545
Palos Hills	IL	17565
Palos Park	IL	4888
Pana	IL	5607
Panama	IL	331
Panola	IL	51
Papineau	IL	165
Paris	IL	8432
Park	IL	0
Park City	IL	7392
Park Forest	IL	21954
Park Ridge	IL	37757
Parkersburg	IL	198
Parkway Garden Homes	IL	2000
Patoka	IL	566
Patterson	IL	130
Paw Paw	IL	821
Pawnee	IL	2713
Paxton	IL	4357
Payson	IL	1011
Pearl	IL	134
Pearl City	IL	805
Pecatonica	IL	2124
Pekin	IL	33223
Penfield	IL	193
Peoria	IL	115070
Peoria Heights	IL	5979
Peotone	IL	4120
Percy	IL	930
Perry	IL	387
Peru	IL	9952
Pesotum	IL	544
Petersburg	IL	2190
Phillipstown	IL	43
Philo	IL	1464
Phoenix	IL	1958
Pierron	IL	565
Pinckneyville	IL	5385
Pingree Grove	IL	6648
Piper	IL	0
Piper City	IL	791
Pistakee Highlands	IL	3454
Pittsburg	IL	559
Pittsfield	IL	4485
Plainfield	IL	42527
Plainville	IL	264
Plano	IL	11282
Plattville	IL	253
Pleasant Hill	IL	989
Pleasant Plains	IL	804
Plum Valley	IL	0
Plymouth	IL	485
Pocahontas	IL	745
Polo	IL	2253
Pontiac	IL	11794
Pontoon Beach	IL	5637
Pontoosuc	IL	143
Poplar Grove	IL	5139
Port Barrington	IL	1504
Port Byron	IL	1649
Portage Park	IL	64841
Posen	IL	5992
Potomac	IL	721
Prairie	IL	0
Prairie City	IL	367
Prairie du Rocher	IL	574
Prairie Grove	IL	1869
Prairietown	IL	0
Preemption	IL	0
Prestbury	IL	1722
Preston Heights	IL	2575
Princeton	IL	7594
Princeville	IL	1726
Prophetstown	IL	2012
Prospect Heights	IL	16386
Pulaski	IL	188
Quincy	IL	40780
Radom	IL	212
Raleigh	IL	348
Ramsey	IL	1026
Rankin	IL	539
Ransom	IL	373
Rantoul	IL	13008
Rapids	IL	0
Rapids City	IL	968
Raritan	IL	132
Raymond	IL	977
Red Bud	IL	3586
Reddick	IL	159
Redmon	IL	165
Rentchler	IL	34
Rest Haven	IL	0
Reynolds	IL	519
Richfield	IL	0
Richmond	IL	1900
Richton Park	IL	13695
Richview	IL	240
Ridge Farm	IL	853
Ridgefield	IL	0
Ridgewood	IL	0
Ridgway	IL	816
Ridott	IL	158
Riggston	IL	0
Riley	IL	0
Ringwood	IL	823
Rio	IL	215
Ripley	IL	85
Ritchie	IL	0
River Forest	IL	11199
River Grove	IL	10219
Riverdale	IL	13536
Riverside	IL	8835
Riverton	IL	3462
Riverwoods	IL	3643
Roanoke	IL	2073
Robbins	IL	5480
Roberts	IL	350
Robinson	IL	7631
Rochelle	IL	9309
Rochester	IL	3779
Rock	IL	0
Rock City	IL	307
Rock Falls	IL	9087
Rock Island	IL	38620
Rock Island Arsenal	IL	149
Rockbridge	IL	163
Rockdale	IL	1948
Rockford	IL	148278
Rockport	IL	0
Rockton	IL	7525
Rockwood	IL	41
Rogers Park	IL	54402
Rolling Meadows	IL	24190
Rome	IL	1738
Romeoville	IL	39719
Roodhouse	IL	1730
Roscoe	IL	10565
Rose Hill	IL	80
Roselle	IL	22994
Rosemont	IL	4206
Roseville	IL	980
Rosewood Heights	IL	4038
Rosiclare	IL	1082
Rossville	IL	1282
Round Lake	IL	18461
Round Lake Beach	IL	27852
Round Lake Heights	IL	2718
Round Lake Park	IL	7426
Roxana	IL	1483
Royal	IL	300
Royal Lakes	IL	190
Royalton	IL	1138
Ruma	IL	315
Rushville	IL	2972
Russellville	IL	91
Rutland	IL	311
Sadorus	IL	419
Sailor Springs	IL	95
Saint Anne	IL	1257
Saint Augustine	IL	120
Saint David	IL	589
Saint Elmo	IL	1426
Saint Francisville	IL	697
Saint Jacob	IL	1098
Saint Johns	IL	219
Saint Joseph	IL	3967
Saint Libory	IL	615
Saint Peter	IL	359
Sainte Marie	IL	244
Salem	IL	7287
Sammons Point	IL	275
San Jose	IL	614
Sandoval	IL	1230
Sandwich	IL	7366
Sauget	IL	152
Sauk	IL	0
Sauk Village	IL	10493
Saunemin	IL	404
Savanna	IL	2880
Savoy	IL	8133
Sawyerville	IL	270
Saybrook	IL	684
Scales Mound	IL	378
Schaumburg	IL	74693
Schiller Park	IL	11806
Schram	IL	0
Schram City	IL	570
Sciota	IL	59
Scott AFB	IL	0
Scott Air Force Base	IL	3612
Scottville	IL	112
Seaton	IL	214
Seatonville	IL	309
Secor	IL	370
Seneca	IL	2292
Serena	IL	0
Sesser	IL	1906
Seymour	IL	303
Shabbona	IL	933
Shannon	IL	712
Shawneetown	IL	1164
Sheffield	IL	892
Shelbyville	IL	4599
Sheldon	IL	1024
Sheridan	IL	2743
Sherman	IL	4605
Sherrard	IL	609
Shiloh	IL	12961
Shipman	IL	603
Shirland	IL	936
Shirley	IL	0
Shorewood	IL	16747
Shumway	IL	201
Sibley	IL	263
Sidell	IL	592
Sidney	IL	1232
Sigel	IL	360
Silvis	IL	7491
Simpson	IL	60
Sims	IL	250
Skokie	IL	64821
Sleepy Hollow	IL	3346
Smithboro	IL	170
Smithfield	IL	221
Smithton	IL	3719
Smithville	IL	0
Solon Mills	IL	0
Somonauk	IL	1877
Sorento	IL	470
South Barrington	IL	4565
South Beloit	IL	7680
South Chicago	IL	28095
South Chicago Heights	IL	4138
South Elgin	IL	22365
South Holland	IL	22043
South Jacksonville	IL	3261
South Lawndale	IL	73826
South Pekin	IL	1120
South Roxana	IL	1997
South Shore	IL	51451
South Wilmington	IL	661
Southern View	IL	1635
Sparland	IL	386
Sparta	IL	4419
Spaulding	IL	869
Spillertown	IL	202
Spring Bay	IL	462
Spring Grove	IL	5711
Spring Valley	IL	5314
Springerton	IL	108
Springfield	IL	114394
St. Anne	IL	0
St. Augustine	IL	0
St. Charles	IL	32974
St. David	IL	0
St. Elmo	IL	0
St. Francisville	IL	0
St. Jacob	IL	0
St. Johns	IL	0
St. Joseph	IL	0
St. Libory	IL	0
St. Peter	IL	0
St. Rose	IL	0
Standard	IL	204
Standard City	IL	147
Stanford	IL	582
Staunton	IL	5018
Ste. Marie	IL	0
Steeleville	IL	1993
Steger	IL	9515
Sterling	IL	15057
Steward	IL	244
Stewardson	IL	716
Stickney	IL	6786
Stillman Valley	IL	1072
Stockton	IL	1792
Stone Park	IL	4931
Stonefort	IL	295
Stonington	IL	890
Stoy	IL	113
Strasburg	IL	447
Strawn	IL	96
Streamwood	IL	40554
Streator	IL	13182
Stronghurst	IL	837
Sublette	IL	428
Sugar Grove	IL	9512
Sullivan	IL	4494
Summerfield	IL	401
Summit	IL	11389
Sumner	IL	3183
Sun River Terrace	IL	518
Sunnyland	IL	0
Swansea	IL	13543
Swedona	IL	0
Sycamore	IL	17712
Symerton	IL	89
Table Grove	IL	401
Tallula	IL	481
Tamaroa	IL	613
Tamms	IL	430
Tampico	IL	759
Taylor Ridge	IL	0
Taylor Springs	IL	673
Taylorville	IL	10873
Tennessee	IL	111
Teutopolis	IL	1586
Thawville	IL	266
Thayer	IL	681
The Galena Territory	IL	1058
Thebes	IL	208
Third Lake	IL	1189
Thomasboro	IL	1133
Thompsonville	IL	536
Thomson	IL	562
Thornton	IL	2492
Tilden	IL	893
Tilton	IL	2626
Timberlane	IL	949
Time	IL	22
Timewell	IL	155
Tinley Park	IL	57143
Tiskilwa	IL	791
Toledo	IL	1221
Tolono	IL	3479
Toluca	IL	1330
Tonica	IL	738
Topeka	IL	72
Toulon	IL	1248
Tovey	IL	489
Towanda	IL	478
Tower Hill	IL	590
Tower Lake	IL	1283
Tower Lakes	IL	0
Tremont	IL	2175
Trenton	IL	2667
Trilla	IL	0
Triumph	IL	0
Trivoli	IL	0
Trout Valley	IL	529
Troy	IL	10036
Troy Grove	IL	243
Tuscola	IL	4443
Twin Grove	IL	1564
Ukrainian Village	IL	15000
Ullin	IL	425
Union	IL	558
Union Hill	IL	57
Unity	IL	108
University Park	IL	7070
Upper Alton	IL	29251
Uptown	IL	55137
Urbana	IL	42311
Ursa	IL	623
Utica	IL	977
Valier	IL	659
Valley	IL	0
Valley City	IL	13
Valmeyer	IL	1263
Vandalia	IL	7112
Varna	IL	363
Venedy	IL	133
Venetian	IL	0
Venetian Village	IL	2826
Venice	IL	1915
Vergennes	IL	294
Vermilion	IL	215
Vermont	IL	646
Vernon	IL	127
Vernon Hills	IL	26314
Verona	IL	212
Versailles	IL	464
Victoria	IL	309
Vienna	IL	1647
Villa Grove	IL	2495
Villa Park	IL	21969
Village of Campton Hills	IL	13483
Viola	IL	924
Virden	IL	3407
Virgil	IL	337
Virginia	IL	1516
Volo	IL	4164
Wadsworth	IL	3739
Waggoner	IL	258
Walnut	IL	1350
Walnut Hill	IL	106
Walshville	IL	62
Waltonville	IL	432
Wamac	IL	1143
Wapella	IL	542
Warren	IL	1376
Warrensburg	IL	1163
Warrenville	IL	13317
Warsaw	IL	1551
Wasco	IL	22560
Washburn	IL	1128
Washington	IL	16664
Washington Park	IL	3990
Wataga	IL	816
Waterloo	IL	10236
Waterman	IL	1494
Watseka	IL	5070
Watson	IL	745
Wauconda	IL	13814
Waukegan	IL	88475
Waverly	IL	1268
Wayne	IL	2444
Wayne City	IL	1012
Waynesville	IL	420
Wedron	IL	0
Weldon	IL	421
Wellington	IL	234
Wenona	IL	995
Wenonah	IL	36
West	IL	0
West Brooklyn	IL	135
West Chicago	IL	27447
West City	IL	654
West Dundee	IL	7395
West Elsdon	IL	19219
West Englewood	IL	32156
West Frankfort	IL	8067
West Garfield Park	IL	17742
West Lawn	IL	32749
West Liberty	IL	0
West Peoria	IL	4418
West Point	IL	174
West Ridge	IL	72211
West Salem	IL	872
West Town	IL	86429
West Union	IL	288
West York	IL	129
Westchester	IL	16729
Western Springs	IL	13369
Westervelt	IL	128
Westfield	IL	580
Westlake	IL	0
Westmont	IL	24941
Westville	IL	3105
Wheaton	IL	53715
Wheeler	IL	146
Wheeling	IL	38079
White	IL	0
White Ash	IL	241
White City	IL	228
White Hall	IL	2410
White Heath	IL	290
Whiteash	IL	0
Williamsfield	IL	560
Williamson	IL	224
Williamsville	IL	1496
Willisville	IL	608
Willow Hill	IL	229
Willow Lake	IL	0
Willow Springs	IL	5695
Willowbrook	IL	8613
Wilmette	IL	27413
Wilmington	IL	5694
Wilsonville	IL	566
Wilton Center	IL	0
Winchester	IL	1513
Windsor	IL	1162
Winfield	IL	9657
Winnebago	IL	3012
Winnetka	IL	12472
Winslow	IL	329
Winthrop Harbor	IL	6818
Witt	IL	872
Wonder Lake	IL	4026
Wood Dale	IL	13917
Wood River	IL	10294
Woodhull	IL	788
Woodland	IL	324
Woodlawn	IL	24150
Woodridge	IL	33370
Woodson	IL	512
Woodstock	IL	25189
Worden	IL	1028
Worth	IL	10784
Wyanet	IL	956
Wyoming	IL	1376
Xenia	IL	382
Yale	IL	86
Yates	IL	0
Yates City	IL	670
Yorkville	IL	18451
Zeigler	IL	1765
Zion	IL	24117
Aberdeen	IN	1875
Abington	IN	0
Adams	IN	0
Adams Lake	IN	0
Advance	IN	511
Akron	IN	1133
Alamo	IN	65
Albany	IN	2119
Albion	IN	2325
Alexandria	IN	5047
Alford	IN	0
Alfordsville	IN	105
Alton	IN	55
Altona	IN	198
Ambia	IN	236
Amboy	IN	378
Americus	IN	423
Amity	IN	0
Amo	IN	415
Anderson	IN	55305
Andersonville	IN	0
Andrews	IN	1133
Angola	IN	8644
Anoka	IN	0
Antioch	IN	0
Arcadia	IN	1666
Arcola	IN	0
Ardmore	IN	0
Argos	IN	1691
Arlington	IN	433
Arthur	IN	0
Ashley	IN	985
Atlanta	IN	735
Attica	IN	3117
Auburn	IN	12979
Aurora	IN	3701
Austin	IN	4295
Avilla	IN	2413
Avoca	IN	583
Avon	IN	16451
Azalia	IN	0
Bainbridge	IN	742
Barbee	IN	0
Bargersville	IN	6846
Bass Lake	IN	1195
Batesville	IN	6611
Battle Ground	IN	1474
Bear Lake	IN	0
Beaver Dam	IN	0
Bedford	IN	13347
Beech Grove	IN	14548
Belleville	IN	0
Bennetts Switch	IN	0
Benton	IN	0
Berne	IN	4084
Bethany	IN	81
Bethel	IN	0
Beverly Shores	IN	610
Bicknell	IN	2892
Big Lake	IN	0
Billtown	IN	0
Bippus	IN	0
Birdseye	IN	407
Blairsville	IN	0
Blanford	IN	342
Blocher	IN	0
Bloomfield	IN	2336
Blooming Grove	IN	0
Bloomingdale	IN	327
Bloomington	IN	84067
Blountsville	IN	132
Blue Ridge	IN	0
Bluffton	IN	10005
Boggstown	IN	0
Boone Grove	IN	0
Boonville	IN	6180
Borden	IN	891
Boston	IN	134
Boswell	IN	762
Bourbon	IN	1781
Bowling Green	IN	0
Boxley	IN	0
Brazil	IN	8109
Bremen	IN	4565
Bretzville	IN	0
Bridgeton	IN	0
Bright	IN	5693
Brimfield	IN	0
Bringhurst	IN	0
Bristol	IN	1667
Broad Ripple	IN	17041
Brook	IN	972
Brooklyn	IN	1601
Brooksburg	IN	81
Brookston	IN	1534
Brookville	IN	2566
Browns Crossing	IN	0
Brownsburg	IN	24996
Brownstown	IN	2952
Brownsville	IN	0
Bruceville	IN	477
Bryant	IN	258
Buck Creek	IN	207
Buckskin	IN	0
Buffalo	IN	692
Bunker Hill	IN	858
Burket	IN	195
Burlington	IN	596
Burnett	IN	0
Burnettsville	IN	341
Burney	IN	0
Burns	IN	0
Burns City	IN	117
Burns Harbor	IN	1609
Burrows	IN	0
Butler	IN	2701
Butlerville	IN	282
Cadiz	IN	145
Cambridge	IN	0
Cambridge City	IN	1784
Camden	IN	600
Campbellsburg	IN	578
Canaan	IN	90
Cannelburg	IN	155
Cannelton	IN	1517
Canton	IN	0
Carbon	IN	397
Carefree	IN	27
Carlisle	IN	692
Carmel	IN	88713
Carrollton	IN	0
Cartersburg	IN	0
Carthage	IN	890
Cass	IN	0
Cassville	IN	0
Castleton	IN	36
Cates	IN	0
Cayuga	IN	1118
Cedar Grove	IN	154
Cedar Lake	IN	12000
Celestine	IN	0
Centenary	IN	0
Center	IN	0
Center Point	IN	239
Centerton	IN	0
Centerville	IN	2576
Chain-O-Lakes	IN	0
Chalmers	IN	503
Chandler	IN	3385
Charlestown	IN	8088
Charlottesville	IN	0
Chesterfield	IN	2495
Chesterton	IN	13433
Chili	IN	0
Chrisney	IN	484
Churubusco	IN	1795
Cicero	IN	4891
Clarks Hill	IN	677
Clarksburg	IN	149
Clarksville	IN	21866
Clay	IN	0
Clay City	IN	840
Claypool	IN	430
Clayton	IN	995
Clear Lake	IN	342
Clermont	IN	1408
Clifford	IN	236
Clinton	IN	4811
Cloverdale	IN	2090
Cloverland	IN	0
Coal	IN	0
Coalmont	IN	402
Coatesville	IN	542
Coesse	IN	0
Colburn	IN	193
Colfax	IN	680
Collegeville	IN	330
Columbia	IN	0
Columbia City	IN	8857
Columbus	IN	46690
Commiskey	IN	0
Connersville	IN	13010
Converse	IN	1231
Cordry Sweetwater Lakes	IN	1128
Cortland	IN	0
Corunna	IN	255
Cory	IN	0
Corydon	IN	3144
Country Club Heights	IN	78
Country Squire Lakes	IN	3571
Covington	IN	2568
Cowan	IN	0
Craigville	IN	0
Crandall	IN	151
Crane	IN	183
Crawfordsville	IN	16024
Cree Lake	IN	0
Cromwell	IN	504
Cross Plains	IN	0
Crothersville	IN	1597
Crown Point	IN	28879
Crows Nest	IN	76
Culver	IN	1396
Cumberland	IN	5467
Cutler	IN	0
Cynthiana	IN	539
Dale	IN	1544
Daleville	IN	1608
Dana	IN	581
Danville	IN	9614
Darlington	IN	843
Darmstadt	IN	1462
Dayton	IN	1578
Decatur	IN	9465
Decker	IN	246
Deer Creek	IN	0
Delaware	IN	0
Delphi	IN	2858
DeMotte	IN	3814
Denver	IN	469
Depauw	IN	0
Deputy	IN	86
Dillsboro	IN	1320
Donaldson	IN	0
Dover Hill	IN	114
Dresser	IN	0
Dublin	IN	769
Dubois	IN	488
Dugger	IN	898
Dune Acres	IN	186
Duneland Beach	IN	0
Dunkirk	IN	2630
Dunlap	IN	6235
Dunreith	IN	174
Dupont	IN	338
Dyer	IN	16051
Earl Park	IN	334
East Chicago	IN	28699
East Enterprise	IN	148
East Germantown	IN	373
East Oolitic	IN	0
Eaton	IN	1748
Eckerty	IN	0
Economy	IN	180
Eden	IN	0
Edgewood	IN	1878
Edinburgh	IN	4546
Edwardsport	IN	300
Elberfeld	IN	642
Elizabeth	IN	161
Elizabethtown	IN	518
Elizaville	IN	0
Elkhart	IN	52348
Ellettsville	IN	6544
Elnora	IN	656
Elrod	IN	0
Elwood	IN	8455
Eminence	IN	0
Emison	IN	154
Enchanted Hills	IN	0
English	IN	630
Etna Green	IN	585
Eugene	IN	0
Evansville	IN	119943
Everton	IN	0
Fair Oaks	IN	0
Fairbanks	IN	0
Fairfield Heights	IN	21285
Fairland	IN	587
Fairmount	IN	2851
Fairview	IN	0
Fairview Park	IN	1386
Farmersburg	IN	1094
Farmland	IN	1284
Ferdinand	IN	2200
Fillmore	IN	526
Fish Lake	IN	1016
Fishers	IN	76794
Fishersburg	IN	0
Flat Rock	IN	0
Flora	IN	1985
Florence	IN	80
Floyds Knobs	IN	0
Folsomville	IN	0
Fontanet	IN	423
Forest	IN	0
Fort Branch	IN	2809
Fort Wayne	IN	260326
Fortville	IN	3957
Foster	IN	0
Fountain	IN	0
Fountain City	IN	780
Fountaintown	IN	0
Fowler	IN	2274
Fowlerton	IN	254
Foxcliff Estates	IN	0
Francesville	IN	837
Francisco	IN	473
Frankfort	IN	16060
Franklin	IN	24598
Frankton	IN	1824
Fredericksburg	IN	85
Freelandville	IN	643
Freetown	IN	385
Fremont	IN	2153
French Lick	IN	1794
Fulton	IN	325
Galena	IN	1818
Galveston	IN	1271
Garrett	IN	6344
Gary	IN	77156
Gas	IN	0
Gas City	IN	5968
Gaston	IN	865
Geneva	IN	1320
Gentryville	IN	269
Georgetown	IN	4705
Gilmer Park	IN	0
Glenwood	IN	242
Glezen	IN	0
Goldsmith	IN	0
Goodland	IN	1014
Goshen	IN	32983
Gosport	IN	803
Grabill	IN	1127
Grammer	IN	0
Grandview	IN	727
Grandview Lake	IN	0
Granger	IN	30465
Grantsburg	IN	0
Grayford	IN	0
Graysville	IN	0
Green Hill	IN	0
Greencastle	IN	10401
Greendale	IN	4431
Greenfield	IN	21497
Greens Fork	IN	412
Greensboro	IN	143
Greensburg	IN	11819
Greentown	IN	2399
Greenville	IN	730
Greenwood	IN	55586
Griffin	IN	167
Griffith	IN	16378
Grissom AFB	IN	0
Grissom Air Force Base	IN	5537
Groveland	IN	0
Groverton	IN	0
Gulivoire Park	IN	3033
Gwynneville	IN	0
Hagerstown	IN	1728
Hamburg	IN	0
Hamilton	IN	1544
Hamlet	IN	800
Hammond	IN	77614
Hanna	IN	463
Hanover	IN	3543
Hardinsburg	IN	245
Harlan	IN	1634
Harmony	IN	656
Harrison Lake	IN	0
Harrodsburg	IN	691
Hartford	IN	0
Hartford City	IN	5992
Hartsville	IN	388
Hartz Lake	IN	0
Hashtown	IN	0
Hatfield	IN	813
Haubstadt	IN	1660
Hayden	IN	521
Haysville	IN	0
Hazleton	IN	256
Hebron	IN	3704
Hedrick	IN	0
Helmer	IN	0
Helmsburg	IN	0
Heltonville	IN	0
Hemlock	IN	0
Henryville	IN	1905
Herbst	IN	112
Heritage Lake	IN	2880
Hessen Cassel	IN	0
Hidden Valley	IN	5387
Highland	IN	22936
Hillisburg	IN	0
Hillsboro	IN	538
Hillsdale	IN	0
Hoagland	IN	821
Hobart	IN	28404
Hobbs	IN	0
Hoffman Lake	IN	0
Holiday Woods	IN	0
Holland	IN	618
Holton	IN	470
Homecroft	IN	743
Homer	IN	0
Hope	IN	2167
Hortonville	IN	0
Howe	IN	807
Hudson	IN	516
Hudson Lake	IN	1297
Huntertown	IN	5387
Huntingburg	IN	6035
Huntington	IN	17095
Huron	IN	0
Hymera	IN	774
Idaville	IN	461
Independence	IN	0
Indian	IN	0
Indian Heights	IN	3011
Indian Village	IN	133
Indianapolis	IN	887642
Ingalls	IN	2382
Ireland	IN	0
Jalapa	IN	171
Jamestown	IN	942
Jasonville	IN	2165
Jasper	IN	15451
Jefferson	IN	0
Jeffersonville	IN	46960
Jerome	IN	0
Jimmerson Lake	IN	0
Johnson	IN	0
Jonesboro	IN	1693
Jonesville	IN	185
Judah	IN	0
Judson	IN	53
Judyville	IN	0
Kempton	IN	312
Kendallville	IN	9927
Kennard	IN	464
Kent	IN	70
Kentland	IN	1698
Kewanna	IN	601
Keystone	IN	0
Kimmell	IN	422
Kingman	IN	488
Kingsbury	IN	245
Kingsford Heights	IN	1421
Kirklin	IN	776
Knightstown	IN	2120
Knightsville	IN	872
Knox	IN	3597
Kokomo	IN	57995
Koontz Lake	IN	1557
Kouts	IN	1967
Kramer	IN	0
La Crosse	IN	537
La Fontaine	IN	861
La Paz	IN	555
La Porte	IN	21916
Laconia	IN	50
Ladoga	IN	984
Lafayette	IN	71111
Lagrange	IN	2715
Lagro	IN	407
Lake	IN	0
Lake Bruce	IN	0
Lake Cicott	IN	0
Lake Dalecarlia	IN	1355
Lake Eliza	IN	0
Lake Everett	IN	0
Lake Hart	IN	235
Lake Holiday	IN	910
Lake Holiday Hideaway	IN	0
Lake of the Woods	IN	0
Lake Santee	IN	0
Lake Station	IN	12054
Lake View	IN	0
Lake Village	IN	765
Lakes of the Four Seasons	IN	7033
Lakeshore Resort	IN	0
Laketon	IN	623
Lakeville	IN	788
Lakewood	IN	0
Lamb	IN	0
Landess	IN	188
Lanesville	IN	569
Laotto	IN	0
Lapel	IN	2053
Larwill	IN	282
Laud	IN	0
Laurel	IN	505
Lawrence	IN	47809
Lawrenceburg	IN	4960
Lawrenceport	IN	0
Leavenworth	IN	231
Lebanon	IN	15892
Leesburg	IN	558
Leiters Ford	IN	0
Leo-Cedarville	IN	3842
Leopold	IN	0
Leroy	IN	0
Letts	IN	0
Lewis	IN	0
Lewisville	IN	360
Liberty	IN	2038
Liberty Center	IN	0
Liberty Mills	IN	0
Libertyville	IN	0
Ligonier	IN	4405
Lincoln	IN	0
Linden	IN	756
Linn Grove	IN	0
Linnsburg	IN	0
Linton	IN	5284
Little York	IN	190
Livonia	IN	126
Lizton	IN	496
Logansport	IN	17793
London	IN	0
Long Beach	IN	1162
Loogootee	IN	2722
Losantville	IN	230
Lowell	IN	9450
Lucerne	IN	0
Lyford	IN	0
Lynn	IN	1055
Lynnville	IN	921
Lyons	IN	724
Mace	IN	0
Mackey	IN	106
Macy	IN	206
Madison	IN	12040
Malden	IN	0
Manchester	IN	0
Manilla	IN	267
Maples	IN	0
Marengo	IN	811
Mariah Hill	IN	0
Marietta	IN	0
Marion	IN	29081
Markle	IN	1095
Markleville	IN	519
Marshall	IN	318
Marshfield	IN	0
Martinsburg	IN	0
Martinsville	IN	11690
Matthews	IN	568
Mauckport	IN	81
Maxwell	IN	0
Mays	IN	0
McCordsville	IN	5773
Mecca	IN	320
Medaryville	IN	592
Medora	IN	698
Mellott	IN	189
Melody Hill	IN	3628
Memphis	IN	695
Mentone	IN	982
Meridian Hills	IN	1682
Merom	IN	225
Merriam	IN	0
Merrillville	IN	35224
Metamora	IN	188
Metz	IN	0
Mexico	IN	836
Miami	IN	0
Michiana Shores	IN	304
Michigan	IN	0
Michigan City	IN	31459
Michigantown	IN	455
Middlebury	IN	3562
Middletown	IN	2260
Midland	IN	0
Mier	IN	78
Milan	IN	1886
Milford	IN	1562
Millersburg	IN	935
Millgrove	IN	0
Millhousen	IN	149
Milltown	IN	799
Millville	IN	0
Milroy	IN	604
Milton	IN	464
Mineral Springs	IN	0
Mishawaka	IN	48261
Mitchell	IN	4252
Modoc	IN	190
Mongo	IN	0
Monon	IN	1746
Monroe	IN	861
Monroe City	IN	536
Monroeville	IN	1324
Monrovia	IN	1427
Monterey	IN	210
Montezuma	IN	983
Montgomery	IN	349
Monticello	IN	5322
Montmorenci	IN	243
Montpelier	IN	1735
Mooreland	IN	365
Moores Hill	IN	587
Mooresville	IN	9623
Morgantown	IN	985
Morocco	IN	1119
Morris	IN	0
Morristown	IN	1358
Mount Auburn	IN	107
Mount Ayr	IN	120
Mount Carmel	IN	104
Mount Etna	IN	103
Mount Summit	IN	347
Mount Vernon	IN	7208
Mulberry	IN	1242
Muncie	IN	70087
Munster	IN	22984
Napoleon	IN	229
Nappanee	IN	6787
Nashville	IN	1077
Needham	IN	0
Needmore	IN	0
New Albany	IN	36732
New Amsterdam	IN	27
New Carlisle	IN	1853
New Castle	IN	17621
New Chicago	IN	1975
New Goshen	IN	390
New Harmony	IN	767
New Haven	IN	15709
New Lebanon	IN	0
New Lisbon	IN	0
New London	IN	0
New Marion	IN	0
New Market	IN	630
New Middletown	IN	93
New Palestine	IN	2221
New Paris	IN	1494
New Pekin	IN	1378
New Point	IN	342
New Richmond	IN	334
New Ross	IN	346
New Salisbury	IN	613
New Trenton	IN	252
New Washington	IN	566
New Whiteland	IN	5906
Newbern	IN	0
Newberry	IN	191
Newburgh	IN	3277
Newport	IN	489
Newtonville	IN	0
Newtown	IN	249
Nineveh	IN	0
Noblesville	IN	59093
North Crows Nest	IN	45
North Grove	IN	0
North Judson	IN	1739
North Liberty	IN	1919
North Madison	IN	12435
North Manchester	IN	5971
North Salem	IN	526
North Terre Haute	IN	4305
North Vernon	IN	6619
North Webster	IN	1158
Norway	IN	386
Notre Dame	IN	5973
Nyona Lake	IN	0
Oak Park	IN	5209
Oakland	IN	0
Oakland City	IN	2430
Oaktown	IN	601
Oakville	IN	0
Odon	IN	1401
Ogden Dunes	IN	1115
Oldenburg	IN	666
Ontario	IN	0
Onward	IN	99
Oolitic	IN	1156
Ora	IN	0
Orestes	IN	411
Orland	IN	437
Orleans	IN	2129
Osceola	IN	2477
Osgood	IN	1610
Ossian	IN	3341
Oswego	IN	0
Otis	IN	9726
Otisco	IN	0
Otter Lake	IN	0
Otterbein	IN	1254
Otwell	IN	434
Owensburg	IN	406
Owensville	IN	1285
Oxford	IN	1141
Painted Hills	IN	677
Palestine	IN	0
Palmyra	IN	934
Paoli	IN	3629
Paragon	IN	660
Paris Crossing	IN	0
Parker	IN	0
Parker City	IN	1370
Parkers Settlement	IN	711
Patoka	IN	729
Patricksburg	IN	0
Patriot	IN	208
Paxton	IN	0
Pence	IN	0
Pendleton	IN	4219
Penntown	IN	0
Pennville	IN	693
Peppertown	IN	0
Perkinsville	IN	0
Perrysville	IN	437
Peru	IN	11060
Petersburg	IN	2347
Petersville	IN	0
Petroleum	IN	0
Philadelphia	IN	0
Pierceton	IN	1027
Pierceville	IN	0
Pine	IN	0
Pine Village	IN	210
Pittsboro	IN	3205
Pittsburg	IN	0
Plainfield	IN	30590
Plainville	IN	493
Pleasant Lake	IN	0
Pleasant Mills	IN	0
Pleasant View	IN	0
Pleasantville	IN	0
Plymouth	IN	10035
Point Isabel	IN	91
Poland	IN	0
Poneto	IN	167
Portage	IN	36738
Porter	IN	4879
Portland	IN	6186
Poseyville	IN	1029
Pottawattamie Park	IN	232
Prairie Creek	IN	0
Prairieton	IN	0
Preble	IN	0
Prince's Lakes	IN	0
Princes Lakes	IN	1330
Princeton	IN	8626
Prospect	IN	0
Pulaski	IN	0
Putnamville	IN	0
Raglesville	IN	141
Ragsdale	IN	129
Rainsville	IN	0
Ramsey	IN	0
Raub	IN	0
Reddington	IN	0
Redkey	IN	1344
Remington	IN	1163
Rensselaer	IN	5927
Reo	IN	0
Reynolds	IN	523
Richland	IN	0
Richmond	IN	35854
Ridgeville	IN	769
Riley	IN	218
Rising Sun	IN	2205
River Forest	IN	22
Riverwood	IN	0
Roachdale	IN	895
Roann	IN	470
Roanoke	IN	1701
Rob Roy	IN	0
Rochester	IN	6065
Rockfield	IN	0
Rockford	IN	0
Rockport	IN	2223
Rockville	IN	2545
Rocky Ripple	IN	627
Roll	IN	0
Rolling Prairie	IN	582
Rome	IN	0
Rome City	IN	1377
Romney	IN	0
Rosedale	IN	702
Roseland	IN	628
Roselawn	IN	4131
Ross	IN	0
Rossville	IN	1631
Royal Center	IN	837
Royerton	IN	0
Rushville	IN	6077
Russellville	IN	349
Russiaville	IN	1098
Saint Bernice	IN	646
Saint Joe	IN	460
Saint John	IN	14850
Saint Leon	IN	678
Saint Mary-of-the-Woods	IN	797
Saint Meinrad	IN	706
Saint Paul	IN	1031
Salamonia	IN	156
Salem	IN	6217
Saline	IN	0
Salt Creek Commons	IN	0
Saltillo	IN	91
San Pierre	IN	144
Sandborn	IN	411
Sandusky	IN	0
Santa Claus	IN	2474
Saratoga	IN	247
Sardinia	IN	0
Saugany Lake	IN	0
Schaefer Lake	IN	0
Schererville	IN	28791
Schneider	IN	269
Schnellville	IN	0
Scipio	IN	153
Scircleville	IN	0
Scotland	IN	134
Scott	IN	0
Scottsburg	IN	6674
Seelyville	IN	1022
Sellersburg	IN	8659
Selma	IN	844
Servia	IN	0
Seymour	IN	19478
Shadeland	IN	1784
Shamrock Lakes	IN	225
Sharpsville	IN	580
Shelburn	IN	1223
Shelby	IN	539
Shelbyville	IN	19133
Shepardsville	IN	237
Sheridan	IN	2934
Shipshewana	IN	684
Shipshewana Lake	IN	0
Shirley	IN	827
Shoals	IN	782
Shorewood Forest	IN	2708
Sidney	IN	83
Silver Lake	IN	923
Simonton Lake	IN	4678
Sims	IN	156
Smithville-Sanders	IN	3184
Snow Lake	IN	0
Solsberry	IN	0
Somerset	IN	401
Somerville	IN	288
South Bend	IN	101516
South Center	IN	0
South Haven	IN	5282
South Milford	IN	0
South Whitley	IN	1743
Southport	IN	1712
Spartanburg	IN	0
Speedway	IN	12127
Spencer	IN	2271
Spencerville	IN	0
Spiceland	IN	868
Spring Grove	IN	332
Spring Grove Heights	IN	388
Spring Hill	IN	0
Spring Hills	IN	98
Spring Lake	IN	217
Springport	IN	144
Spurgeon	IN	202
St. Anthony	IN	0
St. Bernice	IN	0
St. Joe	IN	0
St. John	IN	0
St. Leon	IN	0
St. Mary of the Woods	IN	0
St. Meinrad	IN	0
St. Omer	IN	0
St. Paul	IN	0
St. Wendel	IN	0
Stanford	IN	0
Star	IN	0
Star City	IN	344
State Line	IN	188
Staunton	IN	519
Stendal	IN	0
Stewartsville	IN	0
Stilesville	IN	327
Stillwell	IN	0
Stinesville	IN	213
Stockwell	IN	545
Stone Bluff	IN	0
Straughn	IN	219
Stroh	IN	0
Sullivan	IN	4155
Sulphur Springs	IN	386
Sumava Resorts	IN	0
Summitville	IN	989
Sunman	IN	1039
Swayzee	IN	952
Sweetser	IN	1196
Switz	IN	0
Switz City	IN	290
Syracuse	IN	2877
Tab	IN	36
Talma	IN	0
Taswell	IN	0
Taylorsville	IN	919
Tecumseh	IN	658
Teegarden	IN	0
Tell	IN	0
Tell City	IN	7255
Templeton	IN	0
Tennyson	IN	293
Terre Haute	IN	60825
Thayer	IN	0
Thorntown	IN	1485
Tippecanoe	IN	0
Tipton	IN	5144
Toad Hop	IN	108
Tocsin	IN	0
Topeka	IN	1200
Town of Pines	IN	706
Trafalgar	IN	1150
Trail Creek	IN	2029
Tri-Lakes	IN	1421
Troy	IN	371
Tunnelton	IN	0
Twelve Mile	IN	0
Tyner	IN	0
Ulen	IN	124
Underwood	IN	0
Union	IN	0
Union City	IN	3447
Union Mills	IN	159
Uniondale	IN	311
Universal	IN	344
Upland	IN	3785
Urbana	IN	0
Utica	IN	802
Vallonia	IN	336
Valparaiso	IN	32626
Van Bibber Lake	IN	485
Van Buren	IN	834
Veedersburg	IN	2095
Velpen	IN	0
Vera Cruz	IN	81
Vernon	IN	311
Versailles	IN	2100
Vevay	IN	1679
Vicksburg	IN	0
Vincennes	IN	18012
Vistula	IN	0
Wabash	IN	10381
Wadesville	IN	0
Wakarusa	IN	1814
Waldron	IN	804
Walesboro	IN	0
Walkerton	IN	2264
Wall Lake	IN	0
Wallace	IN	99
Walton	IN	1022
Wanatah	IN	1024
Warren	IN	1223
Warren Park	IN	1539
Warrington	IN	0
Warsaw	IN	14472
Washington	IN	12078
Waterloo	IN	2248
Waveland	IN	421
Waverly	IN	0
Wawaka	IN	0
Waynesville	IN	0
Waynetown	IN	956
Webster	IN	0
Wellsboro	IN	0
West Baden Springs	IN	564
West College Corner	IN	644
West Harrison	IN	284
West Lafayette	IN	45550
West Lebanon	IN	703
West Middleton	IN	0
West Point	IN	0
West Terre Haute	IN	2217
Westfield	IN	36738
Westphalia	IN	202
Westpoint	IN	594
Westport	IN	1422
Westville	IN	5662
Westwood	IN	0
Wheatfield	IN	845
Wheatland	IN	474
Wheeler	IN	443
Whiteland	IN	4320
Whitestown	IN	6013
Whitewater	IN	70
Whiting	IN	4872
Wildwood	IN	0
Wilkinson	IN	447
Williams	IN	286
Williams Creek	IN	421
Williamsburg	IN	0
Williamsport	IN	1848
Willow Branch	IN	0
Winamac	IN	2402
Winchester	IN	4769
Windfall	IN	803
Windsor	IN	0
Winfield	IN	5406
Wingate	IN	263
Winona Lake	IN	4951
Winslow	IN	847
Wolcott	IN	989
Wolcottville	IN	1015
Wolflake	IN	0
Woodburn	IN	1611
Woodlawn Heights	IN	78
Wooster	IN	0
Worthington	IN	1428
Wyatt	IN	0
Wynnedale	IN	239
Yeoman	IN	138
Yorktown	IN	11231
Young America	IN	0
Zanesville	IN	610
Zionsville	IN	26296
Abbyville	KS	88
Abilene	KS	6558
Ada	KS	100
Admire	KS	155
Agenda	KS	64
Agra	KS	247
Albert	KS	172
Alden	KS	146
Alexander	KS	62
Allen	KS	176
Alma	KS	802
Almena	KS	394
Alta Vista	KS	429
Altamont	KS	1047
Alton	KS	99
Altoona	KS	381
Americus	KS	884
Ames	KS	33
Andale	KS	992
Andover	KS	12745
Anthony	KS	2230
Arcadia	KS	310
Argonia	KS	489
Arkansas	KS	0
Arkansas City	KS	12136
Arlington	KS	457
Arma	KS	1451
Asherville	KS	28
Ashland	KS	816
Assaria	KS	411
Atchison	KS	10712
Athol	KS	42
Atlanta	KS	193
Attica	KS	591
Atwood	KS	1187
Auburn	KS	1218
Augusta	KS	9299
Aurora	KS	59
Axtell	KS	403
Baileyville	KS	181
Bala	KS	0
Baldwin	KS	0
Baldwin City	KS	4669
Barnard	KS	68
Barnes	KS	154
Bartlett	KS	77
Basehor	KS	5402
Bassett	KS	14
Bavaria	KS	0
Baxter Springs	KS	4028
Bazine	KS	325
Beattie	KS	195
Beaumont	KS	0
Beaver	KS	0
Bel Aire	KS	0
Bellaire	KS	3934
Belle Plaine	KS	1621
Belleville	KS	1907
Beloit	KS	3790
Belpre	KS	83
Belvue	KS	206
Bendena	KS	117
Benedict	KS	73
Bennington	KS	653
Bentley	KS	523
Benton	KS	876
Bern	KS	166
Beverly	KS	156
Big Bow	KS	0
Bird	KS	0
Bird City	KS	436
Bison	KS	242
Blue Mound	KS	277
Blue Rapids	KS	983
Bluff	KS	0
Bluff City	KS	62
Bogue	KS	144
Bonner Springs	KS	7606
Bremen	KS	0
Brewster	KS	302
Bridgeport	KS	0
Bronson	KS	310
Brookville	KS	266
Brownell	KS	28
Bucklin	KS	794
Bucyrus	KS	193
Buffalo	KS	220
Buhler	KS	1332
Bunker Hill	KS	97
Burden	KS	533
Burdett	KS	241
Burdick	KS	0
Burlingame	KS	892
Burlington	KS	2615
Burns	KS	220
Burr Oak	KS	163
Burrton	KS	895
Bushong	KS	34
Bushton	KS	275
Byers	KS	35
Caldwell	KS	1030
Cambridge	KS	82
Caney	KS	2080
Canton	KS	734
Carbondale	KS	1396
Carlton	KS	42
Cassoday	KS	128
Catharine	KS	104
Cawker	KS	0
Cawker City	KS	455
Cedar	KS	23
Cedar Point	KS	27
Cedar Vale	KS	533
Centerville	KS	0
Centralia	KS	509
Centropolis	KS	0
Chanute	KS	9252
Chapman	KS	1376
Chase	KS	460
Chautauqua	KS	103
Cheney	KS	2159
Cherokee	KS	713
Cherryvale	KS	2230
Chetopa	KS	1082
Chicopee	KS	408
Cimarron	KS	2262
Circleville	KS	168
Claflin	KS	630
Clay Center	KS	4300
Clayton	KS	58
Clearwater	KS	2537
Clifton	KS	537
Climax	KS	68
Clyde	KS	689
Coats	KS	84
Codell	KS	0
Coffeyville	KS	9669
Colby	KS	5417
Coldwater	KS	806
Collyer	KS	107
Colony	KS	404
Columbus	KS	3146
Colwich	KS	1378
Concordia	KS	5218
Conway Springs	KS	1237
Coolidge	KS	88
Copeland	KS	304
Corning	KS	157
Cottonwood Falls	KS	872
Council Grove	KS	2086
Countryside	KS	286
Courtland	KS	270
Coyville	KS	44
Crestline	KS	0
Croweburg	KS	0
Cuba	KS	147
Cullison	KS	102
Culver	KS	119
Cunningham	KS	470
Damar	KS	132
Danville	KS	36
De Soto	KS	6074
Dearing	KS	398
Deerfield	KS	693
Delia	KS	167
Delphos	KS	345
Denison	KS	185
Dennis	KS	0
Denton	KS	148
Derby	KS	23509
Detroit	KS	114
Devon	KS	0
Dexter	KS	275
Dighton	KS	990
Dodge	KS	0
Dodge City	KS	27912
Dorrance	KS	188
Douglass	KS	1695
Downs	KS	855
Dresden	KS	41
Dunlap	KS	29
Durham	KS	107
Dwight	KS	261
Earlton	KS	53
Eastborough	KS	768
Easton	KS	256
Eastshore	KS	0
Edgerton	KS	1736
Edmond	KS	48
Edna	KS	428
Edson	KS	0
Edwardsville	KS	4390
Effingham	KS	521
El Dorado	KS	12931
Elbing	KS	228
Elgin	KS	89
Elk	KS	0
Elk City	KS	308
Elk Falls	KS	97
Elkhart	KS	2042
Ellinwood	KS	2066
Ellis	KS	2064
Ellsworth	KS	3057
Elmdale	KS	53
Elsmore	KS	73
Elwood	KS	1188
Elyria	KS	0
Emmett	KS	190
Emporia	KS	24649
Englewood	KS	73
Ensign	KS	185
Enterprise	KS	820
Erie	KS	1105
Esbon	KS	96
Eskridge	KS	512
Eudora	KS	6378
Eureka	KS	2450
Everest	KS	280
Fairview	KS	254
Fairway	KS	3970
Fall River	KS	152
Falun	KS	87
Farlington	KS	0
Florence	KS	439
Fontana	KS	219
Ford	KS	218
Formoso	KS	90
Fort Dodge	KS	165
Fort Riley	KS	0
Fort Riley North	KS	7761
Fort Riley-Camp Whitside	KS	103
Fort Scott	KS	7838
Fowler	KS	557
Frankfort	KS	701
Franklin	KS	375
Frederick	KS	18
Fredonia	KS	2326
Freeport	KS	5
Frontenac	KS	3422
Fulton	KS	160
Furley	KS	0
Galatia	KS	38
Galena	KS	2930
Galesburg	KS	122
Galva	KS	880
Garden	KS	0
Garden City	KS	27005
Garden Plain	KS	897
Gardner	KS	20868
Garfield	KS	185
Garland	KS	0
Garnett	KS	3258
Gas	KS	522
Gaylord	KS	109
Gem	KS	87
Geneseo	KS	267
Geuda Springs	KS	183
Girard	KS	2760
Glade	KS	92
Glasco	KS	477
Glen Elder	KS	435
Goddard	KS	4719
Goessel	KS	510
Goff	KS	126
Goodland	KS	4457
Gorham	KS	340
Gove	KS	99
Grainfield	KS	264
Grandview Plaza	KS	1662
Grantville	KS	180
Great Bend	KS	15717
Greeley	KS	293
Greeley County	KS	0
Green	KS	128
Greenleaf	KS	312
Greensburg	KS	798
Greenwich	KS	0
Grenola	KS	196
Gridley	KS	336
Grinnell	KS	247
Gypsum	KS	395
Haddam	KS	100
Hallowell	KS	101
Halstead	KS	2093
Hamilton	KS	252
Hamlin	KS	45
Hanover	KS	668
Hanston	KS	204
Hardtner	KS	173
Harper	KS	1397
Harris	KS	51
Hartford	KS	369
Harveyville	KS	243
Havana	KS	98
Haven	KS	1225
Havensville	KS	147
Haviland	KS	695
Hays	KS	21092
Haysville	KS	11212
Hazelton	KS	93
Healy	KS	234
Hepler	KS	131
Herington	KS	2396
Herkimer	KS	0
Herndon	KS	128
Hesston	KS	3813
Hiawatha	KS	3095
Highland	KS	1010
Hill	KS	0
Hill City	KS	1467
Hillsboro	KS	2869
Hillsdale	KS	229
Hoisington	KS	2623
Holcomb	KS	2163
Hollenberg	KS	20
Holton	KS	3263
Holyrood	KS	433
Home	KS	160
Hope	KS	344
Horace	KS	74
Horton	KS	1721
Howard	KS	621
Hoxie	KS	1176
Hoyt	KS	653
Hudson	KS	124
Hugoton	KS	3964
Humboldt	KS	1856
Hunnewell	KS	65
Hunter	KS	56
Huron	KS	53
Hutchinson	KS	41569
Idana	KS	0
Independence	KS	8958
Ingalls	KS	308
Inman	KS	1361
Iola	KS	5470
Ionia	KS	0
Isabel	KS	90
Iuka	KS	165
Jamestown	KS	279
Jennings	KS	95
Jetmore	KS	852
Jewell	KS	412
Johnson	KS	1327
Junction	KS	0
Junction City	KS	24621
Kanopolis	KS	474
Kanorado	KS	154
Kansas	KS	0
Kansas City	KS	152933
Keats	KS	0
Kechi	KS	1996
Kelly	KS	0
Kensington	KS	452
Kickapoo Site 1	KS	101
Kickapoo Site 2	KS	34
Kickapoo Site 5	KS	66
Kickapoo Site 6	KS	15
Kickapoo Site 7	KS	66
Kickapoo Tribal Center	KS	194
Kincaid	KS	118
Kingman	KS	3086
Kinsley	KS	1422
Kiowa	KS	1011
Kipp	KS	59
Kirwin	KS	161
Kismet	KS	459
La Crosse	KS	1262
La Cygne	KS	1111
La Harpe	KS	543
Labette	KS	75
Lafontaine	KS	0
Lake	KS	0
Lake Quivira	KS	936
Lakin	KS	2202
Lancaster	KS	290
Lane	KS	223
Langdon	KS	41
Lansing	KS	11767
Larned	KS	3967
Latham	KS	138
Latimer	KS	19
Lawrence	KS	93917
Leavenworth	KS	35980
Leawood	KS	34579
Lebanon	KS	208
Lebo	KS	905
Lecompton	KS	640
Lehigh	KS	168
Lenexa	KS	52490
Lenora	KS	240
Leon	KS	701
Leona	KS	52
Leonardville	KS	453
Leoti	KS	1484
LeRoy	KS	548
Levant	KS	61
Lewis	KS	434
Liberal	KS	20746
Liberty	KS	116
Liebenthal	KS	98
Lincoln	KS	1274
Lincoln Center	KS	0
Lincolnville	KS	192
Lindsborg	KS	3383
Linn	KS	398
Linn Valley	KS	806
Linwood	KS	384
Little River	KS	544
Logan	KS	554
Lone Elm	KS	24
Long Island	KS	128
Longford	KS	77
Longton	KS	311
Lorraine	KS	135
Lost Springs	KS	67
Louisburg	KS	4276
Louisville	KS	205
Lowell	KS	283
Lucas	KS	332
Ludell	KS	0
Luray	KS	197
Lyndon	KS	1023
Lyons	KS	3725
Macksville	KS	538
Madison	KS	652
Mahaska	KS	80
Maize	KS	4362
Manchester	KS	95
Manhattan	KS	56308
Mankato	KS	840
Manter	KS	160
Maple Hill	KS	621
Mapleton	KS	82
Marienthal	KS	71
Marion	KS	1842
Marquette	KS	622
Marysville	KS	3323
Matfield Green	KS	45
Mayetta	KS	338
Mayfield	KS	110
McConnell AFB	KS	1777
McCracken	KS	181
McCune	KS	404
McDonald	KS	160
McFarland	KS	256
McLouth	KS	854
McPherson	KS	13144
Meade	KS	1624
Medicine Lodge	KS	1988
Melvern	KS	365
Menlo	KS	60
Mentor	KS	0
Meriden	KS	790
Merriam	KS	11288
Milan	KS	80
Mildred	KS	26
Milford	KS	592
Milton	KS	155
Miltonvale	KS	515
Minneapolis	KS	2002
Minneola	KS	707
Mission	KS	9491
Mission Hills	KS	3601
Mission Woods	KS	182
Moline	KS	332
Mont Ida	KS	0
Montezuma	KS	982
Monument	KS	0
Moran	KS	520
Morganville	KS	187
Morland	KS	154
Morrill	KS	227
Morrowville	KS	150
Moscow	KS	319
Mound	KS	0
Mound City	KS	680
Mound Valley	KS	386
Moundridge	KS	1696
Mount Hope	KS	813
Mulberry	KS	507
Mullinville	KS	255
Mulvane	KS	6314
Munden	KS	94
Munjor	KS	213
Murdock	KS	0
Muscotah	KS	171
Narka	KS	89
Nashville	KS	63
Natoma	KS	316
Navarre	KS	0
Neal	KS	0
Neodesha	KS	2357
Neosho Falls	KS	134
Neosho Rapids	KS	263
Ness	KS	0
Ness City	KS	1407
Netawaka	KS	144
New Albany	KS	53
New Cambria	KS	126
New Century	KS	1072
New Salem	KS	0
New Strawn	KS	404
Newbury	KS	0
Newton	KS	19216
Nickerson	KS	1036
Nicodemus	KS	0
Niles	KS	0
Niotaze	KS	76
Norcatur	KS	150
North Newton	KS	1803
Norton	KS	2841
Nortonville	KS	616
Norway	KS	0
Norwich	KS	472
Oak Hill	KS	24
Oaklawn-Sunview	KS	0
Oakley	KS	2045
Oberlin	KS	1761
Odin	KS	101
Offerle	KS	196
Ogallah	KS	0
Ogden	KS	2104
Oketo	KS	64
Olathe	KS	134305
Olivet	KS	65
Olmitz	KS	112
Olpe	KS	538
Olsburg	KS	225
Onaga	KS	697
Oneida	KS	75
Opolis	KS	0
Osage	KS	0
Osage City	KS	2844
Osawatomie	KS	4297
Osborne	KS	1369
Oskaloosa	KS	1086
Oswego	KS	1766
Otis	KS	268
Ottawa	KS	12387
Overbrook	KS	1024
Overland Park	KS	186515
Oxford	KS	1024
Ozawkie	KS	633
Palco	KS	283
Palmer	KS	107
Paola	KS	5527
Paradise	KS	50
Park	KS	120
Park City	KS	7618
Parker	KS	273
Parkerfield	KS	426
Parkerville	KS	56
Parsons	KS	10090
Partridge	KS	245
Pawnee Rock	KS	239
Paxico	KS	216
Peabody	KS	1144
Peck	KS	0
Penalosa	KS	17
Perry	KS	909
Peru	KS	139
Phillipsburg	KS	2524
Piedmont	KS	0
Pierceville	KS	98
Pilsen	KS	0
Piqua	KS	107
Pittsburg	KS	20409
Plains	KS	1088
Plainville	KS	1895
Pleasanton	KS	1175
Plevna	KS	97
Pomona	KS	969
Portis	KS	99
Potwin	KS	436
Powhattan	KS	77
Prairie	KS	0
Prairie View	KS	128
Prairie Village	KS	21877
Pratt	KS	6849
Prescott	KS	262
Preston	KS	160
Pretty Prairie	KS	681
Princeton	KS	265
Protection	KS	498
Quenemo	KS	370
Quinter	KS	948
Radium	KS	24
Radley	KS	0
Ramona	KS	179
Randall	KS	63
Randolph	KS	169
Ransom	KS	279
Rantoul	KS	182
Raymond	KS	78
Reading	KS	230
Redfield	KS	143
Republic	KS	109
Reserve	KS	83
Rexford	KS	230
Richfield	KS	40
Richmond	KS	455
Riley	KS	994
Ringo	KS	0
Riverton	KS	929
Robinson	KS	231
Rock	KS	0
Roeland Park	KS	6827
Rolla	KS	415
Rosalia	KS	171
Rose Hill	KS	3995
Roseland	KS	74
Rossville	KS	1137
Roxbury	KS	104
Rozel	KS	152
Rush Center	KS	162
Russell	KS	4534
Russell Springs	KS	25
Sabetha	KS	2585
Saint Francis	KS	1329
Saint George	KS	639
Saint John	KS	1295
Saint Marys	KS	2627
Saint Paul	KS	629
Salina	KS	47813
Satanta	KS	1133
Savonburg	KS	103
Sawyer	KS	126
Scammon	KS	456
Scandia	KS	351
Schoenchen	KS	208
Scott	KS	0
Scott City	KS	3838
Scottsville	KS	25
Scranton	KS	687
Sedan	KS	1041
Sedgwick	KS	1707
Selden	KS	216
Seneca	KS	2034
Severance	KS	93
Severy	KS	237
Seward	KS	61
Shallow Water	KS	0
Sharon	KS	159
Sharon Springs	KS	761
Shawnee	KS	65046
Silver Lake	KS	1430
Silverdale	KS	0
Simpson	KS	85
Smith Center	KS	1616
Smolan	KS	214
Soldier	KS	140
Solomon	KS	1054
Somerset	KS	0
South Haven	KS	350
South Hutchinson	KS	2556
South Mound	KS	0
Spearville	KS	805
Speed	KS	35
Spivey	KS	76
Spring Hill	KS	5981
St. Benedict	KS	0
St. Francis	KS	0
St. George	KS	0
St. John	KS	0
St. Marks	KS	0
St. Marys	KS	0
St. Paul	KS	0
Stafford	KS	986
Stark	KS	69
Sterling	KS	2293
Stockton	KS	1322
Strong	KS	0
Strong City	KS	458
Stuttgart	KS	0
Sublette	KS	1384
Summerfield	KS	151
Sun	KS	0
Sun City	KS	53
Susank	KS	33
Sycamore	KS	0
Sylvan Grove	KS	261
Sylvia	KS	215
Syracuse	KS	1663
Talmage	KS	99
Tampa	KS	107
Tecumseh	KS	0
Tescott	KS	313
Thayer	KS	497
The Highlands	KS	0
Timken	KS	72
Tipton	KS	207
Tonganoxie	KS	5248
Topeka	KS	125963
Toronto	KS	261
Towanda	KS	1428
Treece (historical)	KS	138
Tribune	KS	793
Troy	KS	988
Turon	KS	378
Tyro	KS	208
Udall	KS	732
Ulysses	KS	6097
Uniontown	KS	268
Urbana	KS	0
Utica	KS	154
Valley Center	KS	7222
Valley Falls	KS	1157
Vassar	KS	530
Vermillion	KS	109
Victoria	KS	1226
Vining	KS	43
Viola	KS	131
Virgil	KS	67
Wabaunsee	KS	0
Wakarusa	KS	260
WaKeeney	KS	1811
Wakefield	KS	980
Waldo	KS	31
Waldron	KS	10
Wallace	KS	58
Walnut	KS	218
Walton	KS	240
Wamego	KS	4627
Washington	KS	1085
Waterville	KS	651
Wathena	KS	1336
Waverly	KS	564
Wayside	KS	0
Webber	KS	24
Weir	KS	647
Welda	KS	129
Wellington	KS	7987
Wells	KS	0
Wellsville	KS	1818
Weskan	KS	161
West Mineral	KS	177
Westmoreland	KS	774
Westphalia	KS	157
Westwood	KS	1719
Westwood Hills	KS	364
Wetmore	KS	369
Wheaton	KS	101
White	KS	0
White City	KS	581
White Cloud	KS	174
Whitewater	KS	710
Whiting	KS	185
Wichita	KS	396119
Willard	KS	92
Williamsburg	KS	384
Williamstown	KS	0
Willis	KS	37
Willowbrook	KS	86
Wilmore	KS	52
Wilroads Gardens	KS	609
Wilsey	KS	147
Wilson	KS	760
Winchester	KS	535
Windom	KS	127
Winfield	KS	12204
Winona	KS	166
Woodbine	KS	171
Woodruff	KS	0
Woodston	KS	136
Wright	KS	163
Yale	KS	0
Yates Center	KS	1331
Yoder	KS	194
Zeandale	KS	0
Zenda	KS	88
Zurich	KS	99
Adairville	KY	889
Ages	KY	0
Albany	KY	2012
Alexandria	KY	9009
Allen	KY	0
Allen City	KY	193
Allensville	KY	157
Anchorage	KY	2420
Annville	KY	1095
Anthoston	KY	0
Arjay	KY	0
Arlington	KY	393
Artemus	KY	590
Ashland	KY	21108
Auburn	KY	1352
Audubon Park	KY	1508
Augusta	KY	1163
Auxier	KY	669
Bancroft	KY	508
Bandana	KY	203
Barbourmeade	KY	1258
Barbourville	KY	3174
Bardstown	KY	13091
Bardwell	KY	694
Barlow	KY	672
Beattyville	KY	1244
Beaver Dam	KY	3618
Bedford	KY	608
Beech Grove	KY	243
Beechmont	KY	689
Beechwood	KY	0
Beechwood Village	KY	1365
Belfry	KY	0
Bellefonte	KY	866
Bellemeade	KY	894
Belleview	KY	343
Bellevue	KY	5892
Bellewood	KY	321
Benham	KY	470
Benton	KY	4357
Berea	KY	14882
Berry	KY	263
Betsy Layne	KY	688
Big Clifty	KY	0
Blackey	KY	158
Blaine	KY	47
Blandville	KY	90
Bloomfield	KY	1052
Blue Ridge Manor	KY	794
Bonnieville	KY	259
Booneville	KY	76
Boston	KY	266
Bowling Green	KY	63616
Bradfordsville	KY	298
Brandenburg	KY	2852
Breckinridge Center	KY	2080
Bremen	KY	195
Briarwood	KY	446
Broad Fields	KY	237
Brodhead	KY	1205
Broeck Pointe	KY	281
Bromley	KY	809
Brooks	KY	2401
Brooksville	KY	638
Brownsboro	KY	0
Brownsboro Farm	KY	664
Brownsboro Village	KY	328
Brownsville	KY	826
Buckhorn	KY	159
Buckner	KY	5837
Buechel	KY	7287
Buffalo	KY	498
Burgin	KY	965
Burkesville	KY	1515
Burlington	KY	15926
Burna	KY	257
Burnside	KY	843
Butler	KY	588
Cadiz	KY	2626
Calhoun	KY	762
California	KY	86
Calvert	KY	0
Calvert City	KY	2532
Camargo	KY	1124
Cambridge	KY	179
Campbellsburg	KY	828
Campbellsville	KY	11237
Campton	KY	431
Caneyville	KY	620
Cannonsburg	KY	856
Carlisle	KY	2010
Carrollton	KY	3886
Carrsville	KY	49
Catlettsburg	KY	1808
Cave	KY	0
Cave City	KY	2394
Cawood	KY	731
Cayce	KY	123
Cecilia	KY	572
Cedarville	KY	49
Centertown	KY	443
Central	KY	0
Central City	KY	5892
Cerulean	KY	314
Chaplin	KY	418
Cherrywood Village	KY	318
Clarkson	KY	895
Claryville	KY	2355
Clay	KY	1141
Clay City	KY	1095
Cleaton	KY	0
Clinton	KY	1318
Cloverport	KY	1156
Coal Run	KY	0
Coal Run Village	KY	1602
Cold Spring	KY	6170
Coldiron	KY	223
Coldstream	KY	1137
Columbia	KY	4644
Columbus	KY	216
Combs	KY	0
Concord	KY	35
Corbin	KY	7389
Corinth	KY	232
Corydon	KY	707
Covington	KY	40997
Coxton	KY	0
Crab Orchard	KY	833
Crayne	KY	173
Creekside	KY	316
Crescent Park	KY	355
Crescent Springs	KY	4010
Crestview	KY	486
Crestview Hills	KY	3340
Crestwood	KY	4847
Crittenden	KY	3848
Crofton	KY	754
Crossgate	KY	230
Cumberland	KY	2103
Cunningham	KY	0
Curdsville	KY	0
Cynthiana	KY	6423
Danville	KY	16690
Dawson Springs	KY	2737
Dayton	KY	5433
Dexter	KY	277
Diablock	KY	453
Dixon	KY	898
Doe Valley	KY	1931
Douglass Hills	KY	5669
Dover	KY	245
Drakesboro	KY	509
Druid Hills	KY	318
Dry Ridge	KY	2205
Dunmor	KY	317
Dwale	KY	329
Dycusburg	KY	26
Earlington	KY	1395
East Bernstadt	KY	716
Eddyville	KY	2577
Edgewood	KY	8769
Edmonton	KY	1568
Ekron	KY	146
Elizabethtown	KY	29678
Elizaville	KY	181
Elk Creek	KY	1539
Elkfork	KY	1539
Elkhorn	KY	0
Elkhorn City	KY	937
Elkton	KY	2175
Elsmere	KY	8536
Eminence	KY	2535
Emlyn	KY	427
Erlanger	KY	18797
Eubank	KY	324
Evarts	KY	962
Ewing	KY	266
Ezel	KY	235
Fairdale	KY	8148
Fairfield	KY	114
Fairmeade	KY	254
Fairview	KY	286
Falmouth	KY	2127
Fancy Farm	KY	458
Farley	KY	4701
Farmers	KY	284
Farmington	KY	245
Ferguson	KY	943
Fern Creek	KY	18409
Fincastle	KY	848
Flat Lick	KY	960
Flatwoods	KY	7335
Fleming-Neon	KY	728
Flemingsburg	KY	2894
Florence	KY	32227
Fordsville	KY	530
Forest Hills	KY	457
Fort Campbell North	KY	13685
Fort Knox	KY	10124
Fort Mitchell	KY	8306
Fort Thomas	KY	16398
Fort Wright	KY	5781
Foster	KY	44
Fountain Run	KY	211
Fox Chase	KY	476
Francisville	KY	7944
Frankfort	KY	28391
Franklin	KY	8787
Fredonia	KY	393
Freeburn	KY	399
Frenchburg	KY	531
Fulton	KY	2235
Gamaliel	KY	366
Garrison	KY	866
Georgetown	KY	32356
Germantown	KY	150
Ghent	KY	320
Gilbertsville	KY	458
Glasgow	KY	14470
Glencoe	KY	359
Glenview	KY	544
Glenview Hills	KY	330
Glenview Manor	KY	191
Goose Creek	KY	294
Goshen	KY	909
Gracey	KY	138
Grand Rivers	KY	374
Gratz	KY	77
Graymoor-Devondale	KY	2950
Grayson	KY	4058
Green Spring	KY	740
Greensburg	KY	2123
Greenup	KY	1157
Greenville	KY	4395
Guthrie	KY	1437
Hanson	KY	736
Hardin	KY	599
Hardinsburg	KY	2333
Hardyville	KY	156
Harlan	KY	1639
Harrodsburg	KY	8394
Hartford	KY	2750
Hawesville	KY	1002
Hazard	KY	5341
Hazel	KY	406
Hazel Green	KY	228
Hebron	KY	5929
Hebron Estates	KY	1145
Henderson	KY	28890
Hendron	KY	4687
Heritage Creek	KY	1076
Hickman	KY	2202
Hickory	KY	0
Hickory Hill	KY	115
High Bridge	KY	242
Highland Heights	KY	7183
Highview	KY	15167
Hills and Dales	KY	144
Hillview	KY	8080
Hindman	KY	741
Hiseville	KY	240
Hodgenville	KY	3256
Hollow Creek	KY	810
Hollyvilla	KY	551
Hopkinsville	KY	32205
Horse Cave	KY	2344
Houston Acres	KY	503
Hunters Hollow	KY	381
Hurstbourne	KY	4359
Hurstbourne Acres	KY	1874
Hustonville	KY	399
Hyden	KY	351
Independence	KY	26819
Indian Hills	KY	2959
Indian Hills Cherokee Section	KY	1011
Inez	KY	684
Ironville	KY	454
Irvine	KY	2416
Irvington	KY	1184
Island	KY	458
Jackson	KY	2356
Jamestown	KY	1804
Jeff	KY	323
Jeffersontown	KY	26946
Jeffersonville	KY	1704
Jenkins	KY	2103
Junction	KY	0
Junction City	KY	2283
Keene	KY	0
Keeneland	KY	374
Kenton Vale	KY	112
Kenvir	KY	297
Kevil	KY	620
Kingsley	KY	392
Knottsville	KY	6270
Kuttawa	KY	661
La Center	KY	1005
La Grange	KY	8619
LaFayette	KY	165
Lakeside Park	KY	2779
Lakeview Heights	KY	235
Lancaster	KY	3864
Langdon Place	KY	969
Latonia Lakes	KY	304
Lawrenceburg	KY	11103
Lebanon	KY	5680
Lebanon Junction	KY	1917
Ledbetter	KY	1683
Leitchfield	KY	6873
Lewisburg	KY	807
Lewisport	KY	1698
Lexington	KY	320347
Lexington-Fayette	KY	314488
Lexington-Fayette urban county	KY	0
Liberty	KY	2160
Lincolnshire	KY	150
Livermore	KY	1354
Livingston	KY	225
London	KY	8126
Lone Oak	KY	454
Loretto	KY	722
Louisa	KY	2455
Louisville	KY	624444
Louisville/Jefferson County	KY	0
Lovelaceville	KY	148
Lowes	KY	98
Loyall	KY	654
Ludlow	KY	4551
Lynch	KY	709
Lyndon	KY	11372
Lynnview	KY	940
Maceo	KY	413
Mackville	KY	225
Madisonville	KY	19539
Magnolia	KY	524
Manchester	KY	1401
Manitou	KY	181
Manor Creek	KY	232
Marion	KY	2986
Marrowbone	KY	217
Martin	KY	602
Maryhill Estates	KY	179
Masonville	KY	1014
Massac	KY	4505
Mayfield	KY	10080
Mayking	KY	487
Mays Lick	KY	242
Maysville	KY	8819
Maytown	KY	243
McCarr	KY	164
McDowell	KY	0
McHenry	KY	393
McKee	KY	789
McKinney	KY	0
McRoberts	KY	784
Meadow Vale	KY	758
Meadowbrook Farm	KY	138
Meadowview Estates	KY	373
Meads	KY	288649
Melbourne	KY	467
Mentor	KY	211
Middlesboro	KY	10730
Middlesborough	KY	0
Middletown	KY	7874
Midway	KY	1701
Millersburg	KY	796
Millstone	KY	117
Milton	KY	572
Mockingbird Valley	KY	169
Monterey	KY	137
Monticello	KY	6090
Moorland	KY	431
Morehead	KY	7622
Morganfield	KY	3578
Morgantown	KY	2475
Mortons Gap	KY	852
Moseleyville	KY	0
Mount Olivet	KY	346
Mount Sterling	KY	7208
Mount Vernon	KY	2583
Mount Washington	KY	14028
Muldraugh	KY	985
Munfordville	KY	1640
Murray	KY	18954
Murray Hill	KY	605
Nebo	KY	231
New Castle	KY	926
New Haven	KY	887
New Hope	KY	129
Newburg	KY	19967
Newport	KY	15354
Nicholasville	KY	29754
Norbourne Estates	KY	454
North Corbin	KY	1773
North Middletown	KY	650
Northfield	KY	1051
Nortonville	KY	1190
Norwood	KY	381
Oak Grove	KY	7989
Oakbrook	KY	9036
Oakland	KY	233
Okolona	KY	17134
Old Brownsboro Place	KY	365
Old Washington	KY	795
Olive Hill	KY	1599
Oneida	KY	410
Onton	KY	141
Orchard Grass Hills	KY	1711
Owensboro	KY	59042
Owenton	KY	1550
Owingsville	KY	1581
Paducah	KY	24864
Paintsville	KY	4249
Panther	KY	0
Paris	KY	9870
Park	KY	0
Park City	KY	555
Park Hills	KY	3007
Park Lake	KY	571
Parkway	KY	0
Parkway Village	KY	665
Pathfork	KY	379
Payne Gap	KY	329
Pembroke	KY	889
Perryville	KY	761
Petersburg	KY	620
Pewee Valley	KY	1529
Phelps	KY	893
Philpot	KY	0
Pikeville	KY	7012
Pine Knot	KY	1621
Pineville	KY	1762
Pioneer	KY	0
Pioneer Village	KY	2840
Pippa Passes	KY	643
Plano	KY	1117
Plantation	KY	859
Pleasant Ridge	KY	0
Pleasant View	KY	350
Pleasure Ridge Park	KY	25813
Pleasureville	KY	844
Plum Springs	KY	490
Plymouth Village	KY	220
Poole	KY	0
Poplar Hills	KY	372
Powderly	KY	732
Prestonsburg	KY	3347
Prestonville	KY	160
Princeton	KY	6174
Prospect	KY	4881
Providence	KY	3492
Pryorsburg	KY	311
Rabbit Hash	KY	315
Raceland	KY	2387
Radcliff	KY	22387
Ravenna	KY	590
Raywick	KY	136
Reidland	KY	4491
Richlawn	KY	416
Richmond	KY	33533
Rineyville	KY	0
River Bluff	KY	426
Riverwood	KY	459
Robards	KY	513
Robinswood	KY	237
Rochester	KY	156
Rockholds	KY	390
Rockport	KY	269
Rolling Fields	KY	662
Rolling Hills	KY	959
Rosine	KY	113
Russell	KY	3260
Russell Springs	KY	2511
Russellville	KY	7056
Ryland Heights	KY	1042
Sacramento	KY	461
Sadieville	KY	332
Saint Charles	KY	277
Saint Dennis	KY	9177
Saint Matthews	KY	17472
Saint Regis Park	KY	1454
Salem	KY	746
Salt Lick	KY	321
Salvisa	KY	420
Salyersville	KY	1816
Sanders	KY	236
Sandy Hook	KY	630
Sardis	KY	147
Science Hill	KY	696
Scottsville	KY	4411
Sebree	KY	1559
Sedalia	KY	295
Seneca Gardens	KY	712
Sharpsburg	KY	343
Shelbyville	KY	15253
Shepherdsville	KY	11967
Shively	KY	15713
Silver Grove	KY	1120
Simpsonville	KY	2702
Slaughters	KY	209
Smithfield	KY	107
Smithland	KY	295
Smiths Grove	KY	736
Somerset	KY	11439
Sonora	KY	487
Sorgho	KY	0
South Carrollton	KY	182
South Park View	KY	7
South Shore	KY	1101
South Wallins	KY	859
South Williamson	KY	602
Southgate	KY	3856
Sparta	KY	266
Spottsville	KY	325
Spring Mill	KY	299
Spring Valley	KY	671
Springfield	KY	3055
Springlee	KY	410
St. Charles	KY	0
St. Joseph	KY	0
St. Mary	KY	0
St. Matthews	KY	0
St. Regis Park	KY	0
Stamping Ground	KY	730
Stanford	KY	3675
Stanley	KY	0
Stanton	KY	2666
Stearns	KY	1416
Strathmoor	KY	0
Strathmoor Gardens	KY	313
Strathmoor Manor	KY	346
Strathmoor Village	KY	663
Sturgis	KY	1912
Summer Shade	KY	307
Summersville	KY	568
Sweeden	KY	171
Sycamore	KY	164
Symsonia	KY	615
Taylor Mill	KY	6769
Taylorsville	KY	1028
Ten Broeck	KY	104
Thornhill	KY	182
Thruston	KY	0
Tolu	KY	88
Tompkinsville	KY	2289
Trenton	KY	386
Union	KY	5795
Uniontown	KY	967
Upton	KY	665
Utica	KY	0
Valley Station	KY	22756
Van Lear	KY	1079
Vanceburg	KY	1448
Verona	KY	1455
Versailles	KY	9146
Vicco	KY	320
Villa Hills	KY	7468
Vine Grove	KY	5760
Virgie	KY	279
Visalia	KY	101
Wallins Creek	KY	149
Walton	KY	3907
Warfield	KY	255
Warsaw	KY	1695
Water Valley	KY	282
Watterson Park	KY	1001
Waverly	KY	312
Wayland	KY	409
Wellington	KY	579
West Buechel	KY	1269
West Liberty	KY	3330
West Louisville	KY	0
West Point	KY	868
West Van Lear	KY	0
Westport	KY	268
Westwood	KY	4746
Wheatcroft	KY	155
Wheelwright	KY	551
Whipps Millgate	KY	394
White Plains	KY	872
Whitesburg	KY	2006
Whitesville	KY	538
Whitley	KY	0
Whitley City	KY	1170
Wickliffe	KY	685
Wilder	KY	3088
Wildwood	KY	271
Williamsburg	KY	5293
Williamstown	KY	3943
Willisburg	KY	287
Wilmore	KY	6247
Winchester	KY	18446
Winding Falls	KY	644
Windy Hills	KY	2428
Wingo	KY	640
Woodburn	KY	377
Woodbury	KY	92
Woodland Hills	KY	696
Woodlawn	KY	250
Woodlawn Park	KY	974
Worthington	KY	1643
Worthington Hills	KY	1496
Worthville	KY	184
Wurtland	KY	1043
Yelvington	KY	0
Abbeville	LA	12434
Abita Springs	LA	2499
Addis	LA	4589
Albany	LA	1104
Alexandria	LA	47889
Alpha Mobile Home Park	LA	1
Ama	LA	1316
Amelia	LA	2459
Amite	LA	4640
Anacoco	LA	845
Angie	LA	243
Arabi	LA	3635
Arcadia	LA	2861
Arnaudville	LA	1069
Ashland	LA	263
Athens	LA	234
Atlanta	LA	154
Avondale	LA	4954
Baker	LA	13695
Baldwin	LA	2345
Ball	LA	3990
Banks Springs	LA	1192
Barataria	LA	1109
Basile	LA	1816
Baskin	LA	247
Bastrop	LA	10713
Batchelor	LA	2389
Baton Rouge	LA	227470
Bawcomville	LA	3588
Bayou Blue	LA	0
Bayou Boeuf	LA	14195
Bayou Cane	LA	19355
Bayou Corne	LA	0
Bayou Country Club	LA	0
Bayou Gauche	LA	2071
Bayou Goula	LA	612
Bayou L'Ourse	LA	0
Bayou Vista	LA	4652
Belcher	LA	257
Belle Chasse	LA	12679
Belle Rose	LA	1902
Belmont	LA	361
Benton	LA	2015
Bernice	LA	1648
Berwick	LA	4765
Bienville	LA	209
Blanchard	LA	2935
Bogalusa	LA	11933
Bonita	LA	265
Boothville	LA	854
Bordelonville	LA	525
Bossier	LA	0
Bossier City	LA	68094
Bourg	LA	2579
Boutte	LA	3075
Boyce	LA	979
Branch	LA	388
Breaux Bridge	LA	8395
Bridge	LA	0
Bridge City	LA	7706
Broussard	LA	11303
Brownfields	LA	0
Brownsfield	LA	5401
Brownsville	LA	4317
Brusly	LA	2785
Bryceland	LA	104
Bunkie	LA	4066
Buras	LA	945
Cade	LA	1723
Calhoun	LA	679
Calvin	LA	225
Cameron	LA	406
Campti	LA	1044
Cankton	LA	491
Carencro	LA	8575
Carlyss	LA	4670
Carville	LA	1108
Castor	LA	247
Catahoula	LA	1094
Cecilia	LA	1980
Center Point	LA	492
Centerville	LA	0
Central	LA	28295
Chackbay	LA	5177
Chalmette	LA	16751
Charenton	LA	1903
Chataignier	LA	361
Chatham	LA	544
Chauvin	LA	2912
Cheneyville	LA	608
Choctaw	LA	879
Choudrant	LA	955
Church Point	LA	4521
Claiborne	LA	11507
Clarence	LA	488
Clarks	LA	1006
Clayton	LA	686
Clinton	LA	1577
Colfax	LA	1524
Collinston	LA	268
Columbia	LA	382
Convent	LA	711
Converse	LA	439
Cotton Valley	LA	974
Cottonport	LA	1953
Coushatta	LA	1852
Covington	LA	9928
Creola	LA	209
Crescent	LA	959
Crowley	LA	13144
Cullen	LA	1125
Cut Off	LA	5976
Darrow	LA	0
Delacroix	LA	0
Delcambre	LA	1866
Delhi	LA	2900
Delta	LA	259
Denham Springs	LA	10125
DeQuincy	LA	3161
DeRidder	LA	10890
Des Allemands	LA	2505
Destrehan	LA	11535
Deville	LA	1764
Dixie Inn	LA	263
Dodson	LA	319
Donaldsonville	LA	7792
Dorseyville	LA	0
Downsville	LA	139
Doyline	LA	795
Dry Prong	LA	438
Dubach	LA	979
Dubberly	LA	263
Dulac	LA	1463
Duson	LA	1775
East Hodge	LA	278
Eastwood	LA	4093
Echo	LA	0
Eden Isle	LA	7041
Edgard	LA	2441
Edgefield	LA	206
Egan	LA	631
Elizabeth	LA	553
Elmwood	LA	4635
Elton	LA	1127
Empire	LA	993
Epps	LA	837
Erath	LA	2107
Eros	LA	149
Erwinville	LA	2192
Estelle	LA	16377
Estherwood	LA	959
Eunice	LA	10310
Evergreen	LA	301
Farmerville	LA	3862
Fenton	LA	372
Ferriday	LA	3375
Fifth Ward	LA	800
Fisher	LA	226
Florien	LA	629
Folsom	LA	792
Fordoche	LA	904
Forest	LA	342
Forest Hill	LA	796
Fort Jesup	LA	509
Fort Polk North	LA	2864
Fort Polk South	LA	9038
Franklin	LA	7302
Franklinton	LA	3782
French Settlement	LA	1130
Frierson	LA	143
Galliano	LA	7676
Gardere	LA	10580
Garyville	LA	2811
Georgetown	LA	325
Gibsland	LA	948
Gilbert	LA	566
Gilliam	LA	161
Gillis	LA	657
Glencoe	LA	211
Glenmora	LA	1320
Gloster	LA	94
Golden Meadow	LA	2060
Goldonna	LA	427
Gonzales	LA	10678
Good Pine	LA	0
Grambling	LA	5209
Gramercy	LA	3457
Grand Bayou Mobile Home Park	LA	14195
Grand Cane	LA	243
Grand Coteau	LA	938
Grand Isle	LA	1399
Grand Point	LA	2473
Gray	LA	5584
Grayson	LA	524
Greensburg	LA	685
Greenwood	LA	3191
Gretna	LA	17880
Grosse Tete	LA	631
Gueydan	LA	1396
Hackberry	LA	1261
Hahnville	LA	3344
Hall Summit	LA	283
Hammond	LA	20480
Harahan	LA	9350
Harrisonburg	LA	337
Harvey	LA	20348
Haughton	LA	3334
Hayes	LA	780
Haynesville	LA	2174
Heflin	LA	232
Henderson	LA	1740
Hessmer	LA	780
Hester	LA	498
Hodge	LA	470
Homer	LA	3005
Hornbeck	LA	465
Hosston	LA	309
Houma	LA	34287
Ida	LA	215
Independence	LA	1810
Inniswold	LA	6180
Iota	LA	1480
Iowa	LA	3219
Jackson	LA	3788
Jamestown	LA	133
Jean Lafitte	LA	1972
Jeanerette	LA	5527
Jefferson	LA	11193
Jena	LA	3417
Jennings	LA	10180
Jonesboro	LA	4587
Jonesville	LA	2181
Jordan Hill	LA	211
Joyce	LA	384
Junction	LA	0
Junction City	LA	566
Kaplan	LA	4617
Keachi	LA	0
Keatchie	LA	271
Kenner	LA	67091
Kentwood	LA	2340
Kilbourne	LA	401
Killian	LA	1304
Killona	LA	793
Kinder	LA	2442
Kraemer	LA	934
Krotz Springs	LA	1203
Labadieville	LA	1854
Lacassine	LA	480
Lacombe	LA	8679
Lafayette	LA	121374
Lafitte	LA	972
Lafourche Crossing	LA	0
Lake Arthur	LA	2742
Lake Charles	LA	76070
Lake Providence	LA	3715
Lakeshore	LA	1930
Lakeview	LA	948
Laplace	LA	29872
Larose	LA	7400
Lawtell	LA	1198
Lebeau	LA	0
Lecompte	LA	1189
Leesville	LA	6333
Lemannville	LA	860
Leonville	LA	1101
Lewisburg	LA	0
Lillie	LA	115
Lisbon	LA	173
Livingston	LA	1917
Livonia	LA	1410
Lockport	LA	2531
Lockport Heights	LA	1286
Logansport	LA	1564
Longstreet	LA	156
Longville	LA	635
Loreauville	LA	899
Lucky	LA	261
Luling	LA	12119
Lutcher	LA	3373
Lydia	LA	952
Madisonville	LA	813
Mamou	LA	3181
Mandeville	LA	12345
Mangham	LA	647
Mansfield	LA	4946
Mansura	LA	1385
Many	LA	2790
Maringouin	LA	1061
Marion	LA	755
Marksville	LA	5533
Marrero	LA	33141
Marthaville	LA	0
Martin	LA	562
Mathews	LA	2209
Maurice	LA	1266
McNary	LA	204
Melville	LA	1050
Mer Rouge	LA	590
Meraux	LA	5816
Mermentau	LA	654
Merrydale	LA	9772
Merryville	LA	1115
Metairie	LA	138481
Metairie Terrace	LA	142489
Midland	LA	0
Midway	LA	1291
Milton	LA	3030
Minden	LA	12690
Minorca	LA	2317
Monroe	LA	49598
Montegut	LA	1786
Monterey	LA	439
Montgomery	LA	721
Monticello	LA	5172
Montpelier	LA	250
Montz	LA	1918
Moonshine	LA	0
Mooringsport	LA	786
Moreauville	LA	904
Morgan	LA	0
Morgan City	LA	11835
Morganza	LA	594
Morrow	LA	0
Morse	LA	804
Moss Bluff	LA	11557
Mound	LA	17
Mount Lebanon	LA	80
Napoleonville	LA	639
Natalbany	LA	2984
Natchez	LA	588
Natchitoches	LA	18365
New Iberia	LA	30754
New Llano	LA	2468
New Orleans	LA	362701
New Orleans Station	LA	0
New Roads	LA	4697
New Sarpy	LA	1464
Newellton	LA	1074
Noble	LA	252
Norco	LA	3074
North Hodge	LA	379
North Vacherie	LA	2346
Norwood	LA	312
Oak Grove	LA	1662
Oak Hills Place	LA	8195
Oak Ridge	LA	134
Oakdale	LA	7710
Oberlin	LA	1752
Oil	LA	0
Oil City	LA	997
Old Jefferson	LA	6980
Olla	LA	1386
Opelousas	LA	16591
Oretta	LA	418
Ossun	LA	2144
Paincourtville	LA	911
Palmetto	LA	162
Paradis	LA	1298
Parks	LA	677
Patterson	LA	6106
Paulina	LA	1178
Pearl River	LA	2530
Perry	LA	0
Pierre Part	LA	3169
Pine Prairie	LA	1592
Pineville	LA	14403
Pioneer	LA	151
Pitkin	LA	576
Plain Dealing	LA	969
Plaquemine	LA	6871
Plaucheville	LA	239
Pleasant Hill	LA	718
Pleasure Bend	LA	250
Point Place	LA	400
Pointe à la Hache	LA	187
Pollock	LA	475
Ponchatoula	LA	7068
Port Allen	LA	5130
Port Barre	LA	2119
Port Sulphur	LA	1760
Port Vincent	LA	749
Powhatan	LA	132
Poydras	LA	2351
Prairieville	LA	26895
Presquille	LA	1807
Prien	LA	7810
Prospect	LA	476
Provencal	LA	608
Quitman	LA	174
Raceland	LA	10193
Rayne	LA	8016
Rayville	LA	3664
Red Chute	LA	6261
Reddell	LA	733
Reeves	LA	230
Reserve	LA	9766
Richmond	LA	543
Richwood	LA	3474
Ridgecrest	LA	666
Ringgold	LA	1432
Rio	LA	0
River Ridge	LA	13494
Roanoke	LA	546
Robeline	LA	170
Rock Hill	LA	274
Rodessa	LA	263
Romeville	LA	130
Rosedale	LA	776
Roseland	LA	1203
Rosepine	LA	1634
Ruston	LA	22340
Saint Francisville	LA	1765
Saint Gabriel	LA	6677
Saint James	LA	828
Saint Joseph	LA	1176
Saint Martinville	LA	6114
Saint Maurice	LA	323
Saint Rose	LA	8122
Saline	LA	266
Sarepta	LA	864
Schriever	LA	6853
Scott	LA	9018
Shenandoah	LA	18399
Shongaloo	LA	176
Shreveport	LA	187593
Sibley	LA	1184
Sicily Island	LA	508
Sikes	LA	113
Simmesport	LA	2117
Simpson	LA	618
Simsboro	LA	859
Singer	LA	287
Siracusaville	LA	422
Slaughter	LA	963
Slidell	LA	27942
Sorrel	LA	766
Sorrento	LA	1582
South Mansfield	LA	346
South Vacherie	LA	3642
Spearsville	LA	134
Spokane	LA	442
Springfield	LA	499
Springhill	LA	5097
St. Francisville	LA	0
St. Gabriel	LA	0
St. James	LA	0
St. Joseph	LA	0
St. Martinville	LA	0
St. Maurice	LA	0
St. Rose	LA	0
Stanley	LA	147
Starks	LA	664
Start	LA	905
Sterlington	LA	2463
Stonewall	LA	2093
Sugartown	LA	54
Sulphur	LA	20189
Sun	LA	483
Sunset	LA	2967
Supreme	LA	1052
Swartz	LA	4536
Taft	LA	63
Tallulah	LA	6995
Tangipahoa	LA	808
Terrytown	LA	23319
Thibodaux	LA	14584
Tickfaw	LA	744
Timberlane	LA	10243
Triumph	LA	216
Trout	LA	0
Tullos	LA	387
Turkey Creek	LA	444
Union	LA	892
Urania	LA	1316
Varnado	LA	327
Venice	LA	202
Ventress	LA	890
Vidalia	LA	4112
Vienna	LA	389
Vienna Bend	LA	1251
Village Saint George	LA	7104
Village St. George	LA	0
Ville Platte	LA	7264
Vinton	LA	3355
Violet	LA	4973
Vivian	LA	3626
Waggaman	LA	10015
Walker	LA	6318
Wallace	LA	671
Wallace Ridge	LA	710
Washington	LA	956
Waterproof	LA	609
Watson	LA	1047
Welcome	LA	800
Welsh	LA	3227
West Ferriday	LA	1478
West Monroe	LA	12966
Westlake	LA	4615
Westminster	LA	3008
Westwego	LA	8542
White Castle	LA	1825
Wilson	LA	574
Winnfield	LA	4565
Winnsboro	LA	4762
Wisner	LA	931
Woodmere	LA	12080
Woodworth	LA	1084
Youngsville	LA	11961
Zachary	LA	16448
Zwolle	LA	1972
Aberdeen	MA	3575
Abington	MA	15985
Acton	MA	20897
Acushnet	MA	10850
Acushnet Center	MA	3073
Adams	MA	5515
Agawam	MA	28761
Alford	MA	406
Allston	MA	28821
Allston/Brighton	MA	4185
Amesbury	MA	18313
Amherst	MA	39833
Amherst Center	MA	19065
Andover	MA	8762
Arlington	MA	42844
Ashburnham	MA	5643
Ashby	MA	2895
Ashfield	MA	1831
Ashland	MA	15802
Ashmont	MA	30000
Assonet	MA	4084
Athol	MA	8265
Attleboro	MA	44284
Auburn	MA	16724
Auburndale	MA	6928
Avon	MA	4521
Ayer	MA	2868
Back Bay	MA	17577
Back of the Hill	MA	6272
Baldwinville	MA	2028
Barnstable	MA	47821
Barre	MA	1009
Beacon Hill	MA	9305
Beaconsfield	MA	7199
Becket	MA	1786
Bedford	MA	12502
Belchertown	MA	2899
Bellevue	MA	5277
Bellingham	MA	4854
Belmont	MA	24729
Bemis	MA	7472
Berkley	MA	5849
Berkshire Heights	MA	3781
Berlin	MA	2422
Bernardston	MA	2193
Beverly	MA	41186
Beverly Cove	MA	40365
Billerica	MA	39904
Blackstone	MA	9163
Blandford	MA	393
Bliss Corner	MA	5280
Bolton	MA	4220
Bondsville	MA	1812
Boston	MA	653833
Boston Seaport	MA	3680
Bourne	MA	1418
Boxborough	MA	4996
Boxford	MA	2339
Boylston	MA	4078
Braintree	MA	37297
Brewster	MA	2000
Bridgewater	MA	7841
Brighton	MA	45977
Brimfield	MA	3397
Brockton	MA	95314
Brook Farm	MA	6551
Brookfield	MA	833
Brookline	MA	58732
Buckland	MA	2026
Burlington	MA	24498
Buzzards Bay	MA	3859
Cambridge	MA	110402
Cambridgeport	MA	13438
Canton	MA	21679
Carlisle	MA	4799
Carver	MA	11718
Cedar Crest	MA	0
Centerville	MA	9190
Charlemont	MA	1382
Charlestown	MA	20397
Charlton	MA	12764
Chatham	MA	1421
Chelmsford	MA	33925
Chelsea	MA	39398
Cheshire	MA	514
Chester	MA	627
Chesterfield	MA	1222
Chestnut Hill	MA	23649
Chicopee	MA	56741
Chilmark	MA	858
Clarendon Hills	MA	8971
Clinton	MA	7389
Cochituate	MA	6569
Cohasset	MA	7388
Colrain	MA	1845
Concord	MA	16810
Conway	MA	1841
Coolidge Corner	MA	5197
Cordaville	MA	2650
Cotuit	MA	2364
Cummington	MA	995
Dalton	MA	7012
Danvers	MA	26493
Dedham	MA	24729
Deerfield	MA	643
Dennis	MA	2407
Dennis Port	MA	3162
Devens	MA	1840
Dighton	MA	6283
Dorchester	MA	97826
Douglas	MA	7168
Dover	MA	2265
Dracut	MA	28831
Dudley	MA	11165
Dunstable	MA	2878
Duxbury	MA	15059
East Boston	MA	43066
East Bridgewater	MA	14021
East Brookfield	MA	1323
East Cambridge	MA	13122
East Dennis	MA	2753
East Douglas	MA	2557
East Falmouth	MA	6038
East Harwich	MA	4872
East Longmeadow	MA	15102
East Pepperell	MA	2059
East Sandwich	MA	3940
East Somerville	MA	8170
Eastham	MA	5548
Easthampton	MA	16611
Easton	MA	23459
Edgartown	MA	4306
Erving	MA	1493
Essex	MA	1471
Everett	MA	46050
Fairhaven	MA	16453
Fairmount	MA	6282
Fall River	MA	94000
Falmouth	MA	3799
Faneuil	MA	2590
Fenway/Kenmore	MA	37733
Fiskdale	MA	2583
Fitchburg	MA	40545
Florida	MA	688
Forestdale	MA	4099
Foxborough	MA	5625
Framingham	MA	68318
Framingham Center	MA	65413
Franklin	MA	30636
Freetown	MA	8472
Gardner	MA	20333
Gill	MA	1387
Gloucester	MA	29781
Goshen	MA	937
Grafton	MA	16583
Granby	MA	1368
Granville	MA	1548
Great Barrington	MA	7172
Green Harbor	MA	0
Green Harbor-Cedar Crest	MA	2609
Greenfield	MA	19753
Groton	MA	1124
Grove Hall	MA	5245
Groveland	MA	6143
Hadley	MA	4877
Halifax	MA	7631
Hamilton Worcester	MA	8460
Hampden	MA	5261
Hancock	MA	734
Hanover	MA	16906
Hanscom AFB	MA	0
Hanson	MA	10209
Hardwick	MA	2668
Harvard	MA	6085
Harwich	MA	13059
Harwich Center	MA	1798
Harwich Port	MA	1644
Hatfield	MA	1318
Haverhill	MA	62765
Hawley	MA	342
Head of Westport	MA	14809
Heath	MA	819
Highland	MA	5016
Hingham	MA	5650
Hinsdale	MA	1905
Holbrook	MA	10791
Holden	MA	17016
Holland	MA	1464
Holliston	MA	14010
Holyoke	MA	40684
Hopedale	MA	3753
Hopkinton	MA	2550
Housatonic	MA	1109
Hubbardston	MA	3977
Hudson	MA	14907
Hull	MA	10293
Huntington	MA	936
Hyannis	MA	14120
Hyde Park	MA	31845
Ipswich	MA	4222
Jamaica Plain	MA	37468
Jeffries Point	MA	8823
Kendall Square	MA	9861
Kingston	MA	12208
Lancaster	MA	7509
Lanesborough	MA	3042
Lawrence	MA	80231
Lee	MA	2051
Leicester	MA	11064
Lenox	MA	1675
Lenox Dale	MA	0
Leominster	MA	41569
Leverett	MA	1692
Lexington	MA	31394
Leyden	MA	785
Lincoln	MA	8197
Littleton Common	MA	2789
Longmeadow	MA	15784
Lowell	MA	110699
Lower Allston	MA	6570
Ludlow	MA	22201
Lunenburg	MA	1760
Lynn	MA	92457
Lynnfield	MA	11596
Madaket	MA	236
Malden	MA	61068
Manchester-by-the-Sea	MA	5366
Mansfield	MA	23380
Mansfield Center	MA	7360
Marblehead	MA	19808
Marion	MA	5213
Marion Center	MA	1111
Marlborough	MA	39818
Marshfield	MA	4335
Marshfield Hills	MA	2356
Marstons Mills	MA	8017
Mashpee	MA	14834
Mashpee Neck	MA	1000
Mattapan	MA	36299
Mattapoisett	MA	6378
Mattapoisett Center	MA	2915
Maynard	MA	10106
Medfield	MA	6483
Medford	MA	57403
Medway	MA	13042
Melrose	MA	27997
Mendon	MA	5378
Merrimac	MA	6245
Methuen	MA	52044
Mid-Cambridge	MA	12988
Middleborough	MA	23116
Middleborough Center	MA	7319
Middlefield	MA	551
Middleton	MA	9859
Milford	MA	25055
Mill River	MA	18
Millbury	MA	13606
Millers Falls	MA	1139
Millis	MA	8040
Millis-Clicquot	MA	4403
Millville	MA	2772
Milton	MA	27003
Milton Center	MA	5763
Milton Upper Mills	MA	6725
Milton Village	MA	5123
Mission Hill	MA	18722
Monomoscoy Island	MA	147
Monson	MA	8505
Monson Center	MA	2107
Montague	MA	8637
Monterey	MA	950
Montgomery	MA	665
Monument Beach	MA	2790
Nahant	MA	3410
Nantucket	MA	7446
Natick	MA	32276
Needham	MA	28886
New Ashford	MA	251
New Bedford	MA	101079
New Braintree	MA	943
New Marlborough	MA	1520
New Salem	MA	945
New Seabury	MA	717
Newburyport	MA	17982
Newton	MA	88817
Newton Center	MA	1701
Newton Corner	MA	5042
Newton Highlands	MA	9976
Newton Lower Falls	MA	1246
Newton Upper Falls	MA	7579
Newtonville	MA	11251
Nonantum	MA	9600
Norfolk	MA	10386
North Adams	MA	13263
North Amherst	MA	6819
North Andover	MA	28222
North Attleborough	MA	0
North Attleborough Center	MA	16796
North Brighton	MA	6531
North Brookfield	MA	2265
North Chicopee	MA	55179
North Eastham	MA	1806
North End	MA	10131
North Falmouth	MA	3084
North Lakeville	MA	2630
North Pembroke	MA	3292
North Plymouth	MA	3600
North Reading	MA	14101
North Scituate	MA	5077
North Seekonk	MA	2643
North Westport	MA	4571
Northampton	MA	28540
Northborough	MA	6167
Northbridge	MA	14061
Northfield	MA	1089
Northwest Harwich	MA	3929
Norton	MA	19808
Norton Center	MA	2671
Norwell	MA	10581
Norwood	MA	28602
Oak Bluffs	MA	3778
Oak Hill Park	MA	7008
Oakham	MA	1702
Ocean Bluff-Brant Rock	MA	4970
Ocean Grove	MA	2811
Onset	MA	1573
Orange	MA	4018
Orient Heights	MA	15741
Orleans	MA	1621
Osterville	MA	2911
Otis	MA	1389
Oxford	MA	6103
Palmer	MA	18261
Paxton	MA	4463
Peabody	MA	52504
Pelham	MA	1428
Pepperell	MA	2504
Peru	MA	835
Petersham	MA	243
Phillipston	MA	1649
Pinehurst	MA	7152
Pittsfield	MA	43303
Plainville	MA	7817
Plymouth	MA	7494
Plympton	MA	2683
Pocasset	MA	2851
Popponesset	MA	220
Popponesset Island	MA	26
Princeton	MA	3412
Provincetown	MA	2642
Quincy	MA	93618
Randolph	MA	32112
Raynham	MA	13153
Raynham Center	MA	4100
Reading	MA	24747
Readville	MA	5041
Rehoboth	MA	11486
Reservoir	MA	5904
Revere	MA	53422
Richmond	MA	1632
Rochester	MA	4661
Rockland	MA	17982
Rockport	MA	4966
Roslindale	MA	27683
Rowe	MA	357
Rowley	MA	1416
Roxbury Crossing	MA	15248
Royalston	MA	1276
Russell	MA	786
Rutland	MA	2111
Sagamore	MA	3623
Salem	MA	42869
Salisbury	MA	4869
Sandisfield	MA	838
Sandwich	MA	2962
Saugus	MA	26628
Savin Hill	MA	5318
Savoy	MA	717
Scituate	MA	5245
Seabrook	MA	455
Seconsett Island	MA	100
Seekonk	MA	13966
Sharon	MA	5658
Sheffield	MA	3393
Shelburne	MA	2094
Shelburne Falls	MA	1731
Sherborn	MA	4273
Shirley	MA	1441
Shrewsbury	MA	33893
Shutesbury	MA	1842
Siasconset	MA	205
Smith Mills	MA	4760
Somerset	MA	18165
Somerville	MA	80318
South Amherst	MA	4994
South Ashburnham	MA	1062
South Boston	MA	571281
South Deerfield	MA	1880
South Dennis	MA	3643
South Duxbury	MA	3360
South Hadley	MA	17652
South Lancaster	MA	1894
South Peabody	MA	50293
South Yarmouth	MA	11092
Southampton	MA	5481
Southborough	MA	9686
Southbridge	MA	19030
Southwick	MA	9444
Spencer	MA	5700
Spring Hill	MA	7873
Springfield	MA	154341
Sterling	MA	7384
Stockbridge	MA	2316
Stoneham	MA	21437
Stoughton	MA	26915
Stow	MA	6005
Sturbridge	MA	2253
Sudbury	MA	17343
Suffolk Downs Station	MA	15000
Sunderland	MA	3843
Sutton	MA	9215
Swampscott	MA	13787
Swansea	MA	16525
Taunton	MA	56789
Teaticket	MA	1692
Templeton	MA	6918
Ten Hills	MA	7062
Tewksbury	MA	29326
The Pinehills	MA	955
Thompsonville	MA	3623
Three Rivers	MA	2890
Topsfield	MA	2717
Townsend	MA	1128
Truro	MA	2123
Tufts University	MA	6877
Turners Falls	MA	4470
Tyngsboro	MA	11366
Tyringham	MA	356
Union Square	MA	14459
Uphams Corner	MA	4549
Upton	MA	3013
Uxbridge	MA	12614
VA Boston Healthcare System, Brockton Campus	MA	5474
Vineyard Haven	MA	2114
Wakefield	MA	24932
Wales	MA	1767
Walpole	MA	5918
Waltham	MA	63378
Ware	MA	6170
Wareham Center	MA	2896
Warren	MA	1405
Warwick	MA	763
Washington	MA	554
Watertown	MA	31915
Watertown Square	MA	5331
Wayland	MA	13155
Webster	MA	11412
Wellesley	MA	27982
Wellfleet	MA	2797
Wendell	MA	1003
Wenham	MA	4518
West Barnstable	MA	1508
West Boylston	MA	7612
West Bridgewater	MA	6750
West Brookfield	MA	1413
West Cambridge/Harvard Square	MA	8023
West Chatham	MA	1410
West Concord	MA	6028
West Dennis	MA	2242
West Falmouth	MA	1738
West Fens	MA	6548
West Newbury	MA	4221
West Newton	MA	9347
West Roxbury	MA	30442
West Somerville/Davis Square	MA	6393
West Springfield	MA	27912
West Stockbridge	MA	1441
West Tisbury	MA	2510
West Wareham	MA	2064
West Warren	MA	0
West Yarmouth	MA	6012
Westborough	MA	4045
Westfield	MA	41690
Westford	MA	21587
Westhampton	MA	1494
Westminster	MA	7028
Weston	MA	11682
Westwood	MA	14029
Weweantic	MA	2105
Weymouth	MA	54395
Whately	MA	1600
White Island Shores	MA	2106
Whitinsville	MA	6704
Whitman	MA	14495
Wilbraham	MA	3915
Williamsburg	MA	2469
Williamstown	MA	4325
Wilmington	MA	22325
Winchendon	MA	4213
Winchester	MA	21374
Windsor	MA	890
Winter Hill	MA	12613
Winthrop	MA	17618
Woburn	MA	39555
Woods Hole	MA	781
Worcester	MA	206518
Wrentham	MA	11251
Yarmouth	MA	25243
Yarmouth Port	MA	5320
Abell	MD	975
Aberdeen	MD	15580
Aberdeen Proving Ground	MD	2093
Abingdon	MD	4826
Accident	MD	316
Accokeek	MD	10573
Adamstown	MD	2372
Adelphi	MD	15086
Algonquin	MD	1241
Allen	MD	210
Allendale	MD	2974
Andrews AFB	MD	0
Andrews Air Force Base	MD	2973
Annapolis	MD	40812
Annapolis Neck	MD	0
Antietam	MD	89
Aquasco	MD	981
Arbutus	MD	20483
Arcadia	MD	1077
Arden on the Severn	MD	1953
Arlington	MD	3065
Armistead Gardens	MD	3779
Arnold	MD	23106
Ashburton	MD	2243
Ashton-Sandy Spring	MD	5628
Aspen Hill	MD	48759
Baden	MD	2128
Bagtown	MD	333
Bakersville	MD	30
Ballenger Creek	MD	18274
Baltimore	MD	585708
Baltimore Highlands	MD	7019
Barclay	MD	2692
Barnesville	MD	178
Barre Circle	MD	300
Barrelville	MD	73
Barton	MD	435
Bartonsville	MD	1451
Bayview	MD	2874
Beaver Creek	MD	251
Beechfield	MD	4013
Bel Air	MD	10190
Bel Air North	MD	30568
Bel Air South	MD	47709
Belair-Parkside	MD	449
Bellona-Gittings	MD	653
Beltsville	MD	16772
Benedict	MD	261
Bennsville	MD	11923
Bensville	MD	0
Berea	MD	3469
Berlin	MD	5065
Berwyn Heights	MD	3280
Bethesda	MD	60858
Better Waverly	MD	2622
Betterton	MD	325
Beverly Hills	MD	637
Biddle Street	MD	935
Bier	MD	173
Big Pool	MD	82
Big Spring	MD	84
Bishopville	MD	531
Bivalve	MD	201
Bladensburg	MD	9640
Bloomington	MD	305
Blythewood	MD	229
Bolton Hill	MD	5034
Boonsboro	MD	3455
Borden Shaft	MD	208
Bowie	MD	58025
Bowleys Quarters	MD	6755
Bowling Green	MD	1077
Bowmans Addition	MD	627
Boyd-Booth	MD	516
Braddock Heights	MD	2608
Brandywine	MD	6719
Breathedsville	MD	254
Brentwood	MD	3191
Brewers Hill	MD	1539
Bridgeview/Greenlawn	MD	1679
Broadway East	MD	3376
Brock Hall	MD	9552
Broening Manor	MD	1971
Brookeville	MD	139
Brooklyn	MD	9549
Brooklyn Park	MD	14373
Brookmont	MD	3468
Brookview	MD	59
Broomes Island	MD	405
Brown Station	MD	0
Brownsville	MD	89
Brunswick	MD	6116
Bryans Road	MD	7244
Bryantown	MD	655
Buckeystown	MD	1019
Burkittsville	MD	155
Burleith-Leighton	MD	638
Burnt Mills	MD	0
Burtonsville	MD	8323
Butcher's Hill	MD	1970
Butlertown	MD	505
Cabin John	MD	2280
California	MD	11857
Callaway	MD	0
Callaway-Garrison	MD	1582
Calvert Beach	MD	808
Calverton	MD	17724
Cambridge	MD	12507
Cameron Village	MD	1310
Camp Springs	MD	19096
Canton	MD	12731
Canton Industrial Area	MD	925
Cape Saint Claire	MD	8747
Cape St. Claire	MD	0
Capitol Heights	MD	4574
Carlos	MD	153
Carney	MD	29941
Carroll - Camden Industrial Area	MD	28
Carroll-South Hilton	MD	1241
Carrollton Ridge	MD	2318
Catonsville	MD	41567
Cavetown	MD	1473
Cearfoss	MD	178
Cecilton	MD	671
Cedar Heights	MD	0
Cedarcroft	MD	626
Cedarville	MD	717
Cedmont	MD	2524
Cedonia	MD	3168
Central Forest Park	MD	1097
Central Park Heights	MD	4339
Centreville	MD	4627
Chance	MD	353
Charles North	MD	1085
Charles Village	MD	8267
Charlestown	MD	1198
Charlotte Hall	MD	1420
Charlton	MD	171
Cherry Hill	MD	7647
Chesapeake	MD	0
Chesapeake Beach	MD	5873
Chesapeake City	MD	691
Chesapeake Landing	MD	0
Chesapeake Ranch Estates	MD	10519
Chesapeake Ranch Estates-Drum Point	MD	11503
Chester	MD	4167
Chestertown	MD	5093
Cheswolde	MD	7592
Cheverly	MD	6485
Chevy Chase	MD	9545
Chevy Chase Section Five	MD	693
Chevy Chase Section Three	MD	801
Chevy Chase View	MD	977
Chevy Chase Village	MD	2060
Chewsville	MD	238
Chillum	MD	33513
Chinquapin Park	MD	1247
Choptank	MD	129
Church Creek	MD	123
Church Hill	MD	747
Clarksburg	MD	13766
Clarysville	MD	73
Clear Spring	MD	351
Clifton Park	MD	16
Clinton	MD	35970
Clover Hill	MD	3542
Cloverly	MD	15126
Cobb Island	MD	1166
Cockeysville	MD	20776
Cold Spring	MD	1108
Coldstream Homestead Montebello	MD	5638
Colesville	MD	14647
College Park	MD	32301
Colmar Manor	MD	1469
Columbia	MD	99615
Concerned Citizens Of Forest Park	MD	1141
Coppin Heights/Ash-Co-East	MD	1845
Coral Hills	MD	9895
Cordova	MD	562
Corriganville	MD	455
Cottage	MD	0
Cottage City	MD	1370
Crellin	MD	264
Cresaptown	MD	4592
Crisfield	MD	2655
Crofton	MD	27348
Croom	MD	2631
Cross Country	MD	5305
Crownsville	MD	1757
Crumpton	MD	0
Cumberland	MD	20130
Curtis Bay	MD	3759
Curtis Bay Industrial Area	MD	20
Cylburn	MD	2212
Damascus	MD	15257
Dames Quarter	MD	167
Danville	MD	271
Dargan	MD	165
Darley Park	MD	913
Darlington	MD	409
Darnestown	MD	6802
Davidsonville	MD	8000
Dawson	MD	103
Deal Island	MD	471
Deale	MD	4945
Deer Park	MD	381
Delmar	MD	0
Denton	MD	4349
Derwood	MD	2381
Detmold	MD	71
Dickeyville	MD	729
District Heights	MD	6144
Dolfield	MD	1799
Dorchester	MD	1565
Downsville	MD	355
Downtown	MD	7171
Druid Heights	MD	1267
Druid Hill Park	MD	27
Drum Point	MD	2731
Dunbar-Broadway	MD	749
Dundalk	MD	63597
Dundalk Marine Terminal	MD	7
Dunkirk	MD	2509
Dunkirk Town Center	MD	2520
Eagle Harbor	MD	66
Eakles Mill	MD	0
East Arlington	MD	2187
East Baltimore Midway	MD	2318
East New Market	MD	390
East Riverdale	MD	15509
Easterwood	MD	1178
Easton	MD	16617
Eastwood	MD	764
Eckhart Mines	MD	932
Eden	MD	823
Edesville	MD	169
Edgemere	MD	8669
Edgemont	MD	231
Edgewater	MD	9023
Edgewood	MD	25562
Edmondson Village	MD	3642
Edmonston	MD	1518
Ednor Gardens-Lakeside	MD	4865
Eldersburg	MD	30531
Eldorado	MD	58
Elkridge	MD	15593
Elkton	MD	15782
Ellerslie	MD	572
Ellicott	MD	0
Ellicott City	MD	65834
Elliott	MD	52
Ellwood Park/Monument	MD	3137
Emmitsburg	MD	3021
Ernstville	MD	56
Essex	MD	39262
Evergreen	MD	355
Fairfield Area	MD	127
Fairland	MD	23681
Fairlee	MD	490
Fairmont	MD	277
Fairmount	MD	457
Fairmount Heights	MD	1570
Fairplay	MD	580
Fairview	MD	76
Fairwood	MD	5031
Fallstaff	MD	4313
Fallston	MD	8958
Federal Hill	MD	2695
Federalsburg	MD	2661
Fells Point	MD	5057
Ferndale	MD	16746
Finzel	MD	547
Fishing Creek	MD	163
Flintstone	MD	177
Flower Hill	MD	0
Forest Glen	MD	6582
Forest Heights	MD	2573
Forest Park	MD	1255
Forest Park Golf Course	MD	358
Forestville	MD	12353
Fort George G Mead Junction	MD	9505
Fort Meade	MD	9327
Fort Ritchie	MD	314
Fort Washington	MD	23717
Fountainhead-Orchard Hills	MD	5666
Four Corners	MD	7945
Frankford	MD	17135
Franklin	MD	290
Franklin Square	MD	2379
Franklintown	MD	1305
Franklintown Road	MD	1338
Frederick	MD	69479
Frenchtown-Rumbly	MD	100
Friendly	MD	9250
Friendship	MD	447
Friendship Heights	MD	0
Friendship Village	MD	4791
Friendsville	MD	476
Frostburg	MD	8667
Fruitland	MD	5215
Fulton	MD	2049
Funkstown	MD	884
Gaithersburg	MD	67456
Galena	MD	598
Galestown	MD	136
Galesville	MD	684
Gambrills	MD	2800
Gapland	MD	109
Garrett Park	MD	1044
Garretts Mill	MD	234
Garrison	MD	8823
Garwyn Oaks	MD	1349
Gay Street	MD	1728
Georgetown	MD	143
Germantown	MD	86395
Gilmore	MD	127
Girdletree	MD	149
Glassmanor	MD	17295
Glen	MD	7766
Glen Burnie	MD	67639
Glen Echo	MD	272
Glen Echo Heights	MD	251
Glen Oaks	MD	2678
Glenarden	MD	6326
Glenham-Belhar	MD	5981
Glenmont	MD	13529
Glenn Dale	MD	13466
Goddard	MD	6177
Golden Beach	MD	3796
Goldsboro	MD	237
Gorman	MD	106
Graceham	MD	0
Graceland Park	MD	2156
Grahamtown	MD	364
Grantsville	MD	765
Grasonville	MD	3425
Greater Upper Marlboro	MD	18720
Greektown	MD	4757
Green Haven	MD	19326
Green Valley	MD	12262
Greenbelt	MD	24272
Greenmount West	MD	1683
Greensboro	MD	1873
Greensburg	MD	229
Greenspring	MD	2718
Grove Park	MD	1776
Guilford	MD	1990
Gwynn Oak	MD	47092
Gwynns Falls	MD	952
Gwynns Falls/Leakin Park	MD	311
Hagerstown	MD	40432
Halfway	MD	10701
Hamilton Hills	MD	9649
Hampden	MD	7346
Hampstead	MD	6359
Hampton	MD	5052
Hancock	MD	1550
Hanlon-Longwood	MD	2240
Hanover	MD	38088
Harlem Park	MD	2582
Harwood	MD	1639
Havre de Grace	MD	13504
Hawkins Point	MD	24
Hebron	MD	1092
Henderson	MD	143
Herald Harbor	MD	2603
Heritage Crossing	MD	918
Highfield-Cascade	MD	1112
Highland	MD	1034
Highland Beach	MD	101
Highlandtown	MD	2915
Hillandale	MD	6043
Hillcrest Heights	MD	16469
Hillen	MD	2114
Hillsboro	MD	158
Hillsmere Shores	MD	2872
Hoes Heights	MD	930
Holabird Industrial Park	MD	27
Hollins Market	MD	1716
Homeland	MD	3186
Honeygo	MD	0
Hopkins Bayview	MD	182
Howard Park	MD	5057
Hughesville	MD	2197
Hunt Valley	MD	23915
Hunting Ridge	MD	1326
Huntingtown	MD	2587
Huntingtown Town Center	MD	3311
Hurlock	MD	2092
Hutton	MD	86
Hyattsville	MD	18501
Idlewood	MD	2495
Ilchester	MD	23476
Indian Head	MD	3857
Indian Springs	MD	64
Inner Harbor	MD	2580
Irvington	MD	4548
Jarrettsville	MD	2916
Jefferson	MD	2111
Jennings	MD	113
Jessup	MD	7137
Jesterville	MD	188
Johns Hopkins Homewood	MD	742
Johnston Square	MD	1993
Jones Falls Area	MD	179
Jonestown	MD	1306
Joppatowne	MD	12616
Jugtown	MD	204
Keedysville	MD	1159
Kemp Mill	MD	12564
Kemps Mill	MD	126
Kenilworth Park	MD	1166
Kennedyville	MD	199
Kensington	MD	2330
Kent Narrows	MD	567
Kernewood	MD	435
Keswick	MD	713
Kettering	MD	12790
Kingstown	MD	1733
Kingsville	MD	4318
Kitzmiller	MD	310
Klondike	MD	118
Konterra	MD	0
Kresson	MD	476
La Plata	MD	9125
La Vale	MD	3551
Lake Arbor	MD	9776
Lake Evesham	MD	540
Lake Shore	MD	19477
Lake Walker	MD	1944
Lakeland	MD	4848
Landover	MD	23078
Landover Hills	MD	1811
Langley Park	MD	18755
Langston Hughes	MD	741
Lanham	MD	10157
Lanham-Seabrook	MD	18190
Lansdowne	MD	8409
Largo	MD	10709
Lauraville	MD	3759
Laurel	MD	26215
Layhill	MD	5169
Laytonsville	MD	374
Leisure World	MD	8749
Leitersburg	MD	573
Leonardtown	MD	3633
Levindale	MD	1077
Lewistown	MD	0
Lexington Park	MD	11626
Libertytown	MD	950
Linganore	MD	8543
Linthicum	MD	10324
Lisbon	MD	282
Little Italy	MD	674
Little Orleans	MD	42
Loch Lynn Heights	MD	536
Loch Raven	MD	5611
Lochearn	MD	25333
Locust Point	MD	2893
Locust Point Industrial Area	MD	955
Lonaconing	MD	1144
Londontowne	MD	8018
Long Beach	MD	1821
Loyola/Notre Dame	MD	2986
Lucille Park	MD	431
Luke	MD	63
Lusby	MD	1835
Lutherville	MD	6504
Lutherville-Timonium	MD	15814
Madison	MD	204
Madison Park	MD	1925
Madison-Eastend	MD	1824
Manchester	MD	5408
Mapleville	MD	238
Mardela Springs	MD	350
Marlboro	MD	0
Marlboro Meadows	MD	3672
Marlboro Village	MD	9438
Marlow Heights	MD	5618
Marlton	MD	9031
Martin's Additions	MD	0
Martins Additions	MD	933
Marydel	MD	136
Maryland	MD	0
Maryland City	MD	16093
Maryland Park	MD	0
Maugansville	MD	3071
Mayfield	MD	858
Mayo	MD	8298
Mays Chapel	MD	11420
McCoole	MD	511
McElderry Park	MD	3690
Mechanicsville	MD	1508
Medfield	MD	2791
Medford	MD	1284
Mellwood	MD	3051
Melwood	MD	0
Mercersville	MD	130
Mid-Govans	MD	1302
Mid-Town Belvedere	MD	4666
Middle Branch/Reedbird Parks	MD	20
Middle East	MD	1872
Middle River	MD	25191
Middleburg	MD	70
Middletown	MD	4469
Midland	MD	429
Midlothian	MD	320
Midtown-Edmondson	MD	1096
Milford Mill	MD	29042
Millhill	MD	1404
Millington	MD	617
Milton-Montford	MD	1088
Mitchellville	MD	10967
Mondawmin	MD	2900
Monrovia	MD	416
Montebello	MD	48
Montgomery	MD	0
Montgomery Village	MD	32032
Moravia-Walther	MD	978
Morgan Park	MD	245
Morgan State University	MD	1589
Morningside	MD	2086
Morrell Park	MD	3970
Moscow	MD	240
Mosher	MD	1103
Mount Aetna	MD	561
Mount Airy	MD	9380
Mount Briar	MD	160
Mount Holly	MD	1304
Mount Lena	MD	515
Mount Rainier	MD	8475
Mount Savage	MD	873
Mount Vernon	MD	5497
Mount Washington	MD	4111
Mount Winans	MD	725
Mountain Lake Park	MD	2111
Myersville	MD	1708
Nanticoke	MD	225
Nanticoke Acres	MD	103
National	MD	56
National Harbor	MD	3788
Naval Academy	MD	4802
New Carrollton	MD	12786
New Market	MD	1525
New Northwood	MD	4517
New Southwest/Mount Clare	MD	1811
New Windsor	MD	1400
Newark	MD	336
Nikep	MD	116
North Beach	MD	2014
North Bel Air	MD	33925
North Bethesda	MD	43828
North Brentwood	MD	540
North Chevy Chase	MD	588
North East	MD	3723
North Harford Road	MD	5069
North Kensington	MD	9514
North Laurel	MD	4474
North Potomac	MD	24410
North Roland Park/Poplar Hill	MD	1367
Northwest Community Action	MD	1378
O'Donnell Heights	MD	972
Oakenshawe	MD	971
Oakland	MD	1875
Oaklee	MD	763
Ocean	MD	32
Ocean City	MD	7055
Ocean Pines	MD	11710
Odenton	MD	37132
Old Town	MD	2370
Oldtown	MD	86
Oliver	MD	3771
Olney	MD	33844
Orangeville	MD	200
Orangeville Industrial Area	MD	33
Orchard Ridge	MD	1038
Original Northwood	MD	1155
Otterbein	MD	2677
Overlea	MD	12275
Owings	MD	2149
Owings Mills	MD	30622
Oxford	MD	621
Oxon Hill	MD	17722
Oxon Hill-Glassmanor	MD	35355
Panway/Braddish Avenue	MD	1280
Paramount-Long Meadow	MD	2571
Park Circle	MD	2428
Parklane	MD	1796
Parkview/Woodbrook	MD	1597
Parkville	MD	30734
Parole	MD	15922
Parsonsburg	MD	339
Pasadena	MD	24287
Patterson Park	MD	19
Patterson Park Neighborhood	MD	5438
Patterson Place	MD	1171
Pecktonville	MD	167
Pen Lucy	MD	2741
Penn North	MD	1613
Penn-Fallsway	MD	2594
Penrose/Fayette Street Outreach	MD	2514
Peppermill	MD	0
Peppermill Village	MD	4895
Perkins Homes	MD	858
Perring Loch	MD	2752
Perry Hall	MD	28474
Perryman	MD	2342
Perryville	MD	4437
Pikesville	MD	30764
Pimlico Good Neighbors	MD	858
Pinesburg	MD	449
Piney Point	MD	864
Pittsville	MD	1428
Pleasant Grove	MD	353
Pleasant Hills	MD	3379
Pleasant View Gardens	MD	671
Pocomoke	MD	0
Pocomoke City	MD	4133
Point of Rocks	MD	1466
Pomfret	MD	517
Pondsville	MD	158
Poolesville	MD	5201
Poppleton	MD	2910
Port Covington	MD	14
Port Deposit	MD	659
Port Tobacco	MD	36
Potomac	MD	44965
Potomac Heights	MD	1117
Potomac Park	MD	2530
Powellville	MD	189
Preston	MD	703
Prince Frederick	MD	2538
Princess Anne	MD	3303
Pulaski Industrial Area	MD	171
Pumphrey	MD	5322
Purnell	MD	596
Pylesville	MD	693
Quantico	MD	133
Queen Anne	MD	1280
Queenland	MD	1929
Queensland	MD	0
Queenstown	MD	652
Radnor-Winston	MD	552
Ramblewood	MD	1670
Randallstown	MD	32430
Rawlings	MD	693
Redland	MD	17242
Reid	MD	54
Reisterstown	MD	25968
Reisterstown Station	MD	1752
Remington	MD	2678
Reservoir Hill	MD	5263
Richnor Springs	MD	652
Ridgely	MD	1615
Ridgely's Delight	MD	817
Ringgold	MD	166
Rising Sun	MD	2859
Riva	MD	4076
Riverdale Park	MD	7305
Riverside	MD	6523
Riviera Beach	MD	12677
Robinwood	MD	6918
Rock Hall	MD	1303
Rock Point	MD	107
Rockville	MD	66980
Rognel Heights	MD	1535
Rohrersville	MD	175
Roland Park	MD	4329
Romancoke	MD	0
Rosaryville	MD	10697
Rosebank	MD	403
Rosedale	MD	19257
Rosemont	MD	2220
Rosemont East	MD	1959
Rosemont Homeowners/Tenants	MD	1273
Rossmoor	MD	8453
Rossville	MD	15147
Sabillasville	MD	354
Sabina-Mattfeldt	MD	187
Saint Agnes	MD	574
Saint Charles	MD	36376
Saint George Island	MD	257
Saint James	MD	2953
Saint Josephs	MD	1594
Saint Leonard	MD	742
Saint Michaels	MD	1029
Saint Paul	MD	122
Salisbury	MD	32899
San Mar	MD	384
Sandtown-Winchester	MD	6162
Sandy Hook	MD	188
Savage	MD	7054
Scaggsville	MD	24333
Seabrook	MD	17287
Seat Pleasant	MD	4780
Secretary	MD	529
Selby-on-the-Bay	MD	4040
Seton Business Park	MD	172
Seton Hill	MD	1129
Severn	MD	44231
Severna Park	MD	37634
Shady Side	MD	5803
Shaft	MD	0
Sharp-Leadenhall	MD	1260
Sharpsburg	MD	704
Sharptown	MD	645
Shipley Hill	MD	1404
Silver Hill	MD	5950
Silver Spring	MD	71452
Smith Island	MD	276
Smithsburg	MD	2998
Snow Hill	MD	2086
Solomons	MD	2368
Somerset	MD	1288
South Baltimore	MD	3871
South Bel Air	MD	48828
South Clifton Park	MD	567
South Gate	MD	29658
South Kensington	MD	8462
South Laurel	MD	26112
Spencerville	MD	1594
Spring Gap	MD	55
Spring Garden Industrial Area	MD	82
Spring Ridge	MD	5795
Springdale	MD	2994
St. Charles	MD	33379
St. George Island	MD	0
St. James	MD	0
St. Leonard	MD	0
St. Michaels	MD	0
Stadium Area	MD	109
Stevensville	MD	6803
Still Pond	MD	0
Stockton	MD	92
Stonewood-Pentwood-Winston	MD	765
Sudlersville	MD	485
Suitland	MD	25825
Suitland-Silver Hill	MD	33515
Summerfield	MD	10898
Swanton	MD	58
Sykesville	MD	4412
Takoma Park	MD	17713
Tall Timbers	MD	462
Taneytown	MD	6746
Taylor Heights	MD	359
Taylors Island	MD	173
Temple Hills	MD	7852
Templeville	MD	112
Ten Hills	MD	1280
Ten Mile Creek	MD	0
The Orchards	MD	566
Thurmont	MD	6454
Tilghman Island	MD	784
Tilghmanton	MD	465
Timonium	MD	9925
Tolchester	MD	329
Towanda-Grantley	MD	988
Towson	MD	55197
Trappe	MD	1025
Travilah	MD	12159
Trego-Rohrersville Station	MD	172
Tremont	MD	889
Trial	MD	1000
Tuscany-Canterbury	MD	4304
Tyaskin	MD	236
Union Bridge	MD	971
Union Square	MD	1011
University Of Maryland	MD	602
University Park	MD	2665
Uplands	MD	1270
Upper Fells Point	MD	3959
Upper Marlboro	MD	667
Upton	MD	4817
Urbana	MD	9175
Vale Summit	MD	139
Vienna	MD	276
Village of Cross Keys	MD	883
Villages Of Homeland	MD	487
Violetville	MD	2403
Wakefield	MD	1710
Walbrook	MD	2244
Waldorf	MD	67752
Walker Mill	MD	11302
Walkersville	MD	5993
Waltherson	MD	6181
Washington Grove	MD	578
Washington Hill	MD	2364
Washington Village/Pigtown	MD	4823
Waterview	MD	40
Waverly	MD	2383
West Arlington	MD	1773
West Denton	MD	52
West Elkridge	MD	28734
West Forest Park	MD	2196
West Hills	MD	1876
West Laurel	MD	4230
West Ocean	MD	0
West Ocean City	MD	4375
West Pocomoke	MD	454
Westernport	MD	1810
Westfield	MD	3111
Westgate	MD	2647
Westminster	MD	18670
Westphalia	MD	7266
Westport	MD	1287
Whaleyville	MD	149
Wheaton	MD	48284
White Marsh	MD	9513
White Oak	MD	17403
Whitehaven	MD	43
Wildewood	MD	0
Willards	MD	989
Williamsport	MD	2162
Williston	MD	155
Wilson Park	MD	660
Wilson-Conococheague	MD	2282
Woodland	MD	113
Woodlawn	MD	37879
Woodmore	MD	3936
Woodsboro	MD	1196
Worton	MD	249
Yale Heights	MD	2046
Yarrowsburg	MD	133
Zihlman	MD	362
Acton	ME	2230
Addison	ME	1257
Albion	ME	2023
Alexander	ME	534
Alfred	ME	2596
Allagash	ME	288
Alna	ME	702
Alton	ME	848
Amherst	ME	239
Andover	ME	898
Anson	ME	752
Appleton	ME	1321
Argyle	ME	263
Arrowsic	ME	496
Arundel	ME	3571
Ashland	ME	709
Athens	ME	881
Auburn	ME	22871
Augusta	ME	18899
Aurora	ME	126
Avon	ME	524
Bancroft	ME	63
Bangor	ME	32391
Bar Harbor	ME	2552
Baring	ME	284
Bath	ME	8305
Beals	ME	643
Beddington	ME	30
Belfast	ME	6682
Belgrade	ME	3096
Benton	ME	2658
Berwick	ME	2187
Bethel	ME	2507
Biddeford	ME	21282
Bingham	ME	758
Blaine	ME	301
Blanchard	ME	86
Blue Hill	ME	943
Boothbay	ME	3077
Boothbay Harbor	ME	1086
Bowdoinham	ME	722
Bowerbank	ME	128
Bradford	ME	1233
Bradley	ME	1291
Bremen	ME	813
Brewer	ME	9232
Bridgewater	ME	636
Bridgton	ME	2071
Brighton	ME	89
Bristol	ME	2749
Brooklin	ME	874
Brooks	ME	1063
Brooksville	ME	947
Brownfield	ME	1301
Brownville	ME	1309
Brownville Junction	ME	0
Brunswick	ME	15175
Brunswick Station	ME	578
Buckfield	ME	1791
Bucksport	ME	2885
Burlington	ME	365
Burnham	ME	1187
Buxton	ME	8136
Byron	ME	126
Calais	ME	2980
Cambridge	ME	512
Camden	ME	3570
Canaan	ME	2097
Canton	ME	1165
Cape Neddick	ME	2568
Caratunk	ME	112
Caribou	ME	7816
Carmel	ME	2512
Carroll	ME	150
Carthage	ME	541
Cary	ME	226
Casco	ME	587
Castine	ME	1029
Centerville	ME	27
Chapman	ME	483
Charleston	ME	1452
Charlotte	ME	337
Chelsea	ME	2661
Cherryfield	ME	1203
Chester	ME	546
Chesterville	ME	1216
China	ME	4269
Chisholm	ME	1380
Clifton	ME	772
Clinton	ME	1419
Codyville	ME	20
Columbia	ME	477
Columbia Falls	ME	623
Cooper	ME	151
Corinna	ME	2230
Cornish	ME	1319
Cornville	ME	1256
Cousins Island	ME	490
Cranberry Isles	ME	133
Crawford	ME	112
Crystal	ME	296
Cumberland Center	ME	2499
Cushing	ME	1374
Cutler	ME	648
Dallas	ME	260
Damariscotta	ME	1142
Danforth	ME	654
Dayton	ME	1805
Deblois	ME	51
Dedham	ME	1478
Deer Isle	ME	1950
Denmark	ME	1044
Dennistown	ME	31
Dennysville	ME	332
Detroit	ME	848
Dexter	ME	2158
Dixfield	ME	1076
Dixmont	ME	1107
Dover-Foxcroft	ME	2528
Dunstan	ME	0
Dyer Brook	ME	207
Eagle Lake	ME	625
East Machias	ME	1350
East Millinocket	ME	1567
Eastbrook	ME	385
Easton	ME	1299
Eastport	ME	1266
Eddington	ME	2133
Edgecomb	ME	1133
Eliot	ME	6528
Ellsworth	ME	7857
Embden	ME	916
Enfield	ME	1680
Estcourt Station	ME	4
Etna	ME	1052
Eustis	ME	712
Fairfield	ME	2638
Falmouth	ME	1855
Falmouth Foreside	ME	1511
Farmingdale	ME	1970
Farmington	ME	4288
Fayette	ME	1081
Fort Fairfield	ME	1825
Fort Kent	ME	2488
Frankfort	ME	1082
Franklin	ME	1424
Freedom	ME	671
Freeport	ME	1485
Frenchboro	ME	40
Frenchville	ME	1037
Friendship	ME	1252
Fryeburg	ME	1631
Gardiner	ME	5597
Garland	ME	1029
Gilead	ME	162
Gorham	ME	6882
Gouldsboro	ME	2018
Grand Isle	ME	539
Grand Lake Stream	ME	156
Gray	ME	884
Great Pond	ME	49
Greenbush	ME	1477
Greene	ME	0
Greene Village	ME	4238
Greenville	ME	1257
Greenwood	ME	834
Guilford	ME	903
Hallowell	ME	2315
Hamlin	ME	267
Hampden	ME	4343
Hancock	ME	2232
Hanover	ME	261
Harmony	ME	992
Harpswell Center	ME	5281
Harrington	ME	917
Harrison	ME	2407
Hartford	ME	1001
Hartland	ME	813
Haynesville	ME	127
Hebron	ME	1095
Hermon	ME	4909
Hersey	ME	66
Hiram	ME	1479
Hodgdon	ME	1289
Holden	ME	2939
Hollis Center	ME	4637
Hope	ME	1362
Houlton	ME	5002
Howland	ME	1096
Hudson	ME	1448
Island Falls	ME	824
Isle Au Haut	ME	82
Islesboro	ME	627
Jackman	ME	746
Jackson	ME	526
Jay	ME	4988
Jefferson	ME	2483
Jonesboro	ME	618
Jonesport	ME	1464
Kenduskeag	ME	1217
Kennebunk	ME	5214
Kennebunkport	ME	1238
Kezar Falls	ME	0
Kingfield	ME	1147
Kingman	ME	221
Kingsbury	ME	9
Kittery	ME	4562
Kittery Point	ME	1012
Lagrange	ME	777
Lake Arrowhead	ME	3071
Lake View	ME	45
Lebanon	ME	5446
Lee	ME	879
Leeds	ME	2080
Levant	ME	2257
Lewiston	ME	36202
Liberty	ME	964
Limerick	ME	2329
Limestone	ME	1075
Limington	ME	3538
Lincoln	ME	2884
Lincolnville	ME	2123
Linneus	ME	927
Lisbon	ME	9392
Lisbon Falls	ME	4100
Little Falls	ME	708
Littlejohn Island	ME	118
Littleton	ME	993
Livermore	ME	2190
Livermore Falls	ME	1594
Long Island	ME	210
Lovell	ME	1013
Lowell	ME	303
Lubec	ME	349
Ludlow	ME	418
Machias	ME	1274
Machiasport	ME	1206
Macwahoc	ME	102
Madawaska	ME	2967
Madison	ME	2630
Madrid	ME	180
Manchester	ME	2563
Mapleton	ME	683
Mariaville	ME	430
Mars Hill	ME	980
Marshfield	ME	514
Masardis	ME	265
Mattawamkeag	ME	858
Mechanic Falls	ME	2237
Meddybemps	ME	156
Medford	ME	240
Medway	ME	1548
Mercer	ME	673
Mexico	ME	1743
Milbridge	ME	1330
Milford	ME	2233
Millinocket	ME	4466
Milo	ME	1847
Milton	ME	128
Minot	ME	2337
Monhegan	ME	78
Monmouth	ME	3935
Monroe	ME	917
Monson	ME	692
Monticello	ME	821
Moose River	ME	228
Morrill	ME	805
Moscow	ME	600
Mount Vernon	ME	1584
Naples	ME	428
New Gloucester	ME	5389
New Limerick	ME	544
New Portland	ME	816
New Sharon	ME	1348
New Sweden Station	ME	646
New Vineyard	ME	754
Newcastle	ME	667
Newfield	ME	1381
Newport	ME	1776
Newry	ME	358
Nobleboro	ME	1691
Norridgewock	ME	1438
North Anson	ME	0
North Bath	ME	9363
North Berwick	ME	1615
North Haven	ME	396
North Penobscot	ME	461
North Windham	ME	4904
Northeast Harbor	ME	0
Northfield	ME	136
Northport	ME	1384
Norway	ME	2748
Oak Hill	ME	0
Oakfield	ME	761
Oakland	ME	2602
Ogunquit	ME	1275
Old	ME	0
Old Orchard Beach	ME	8624
Old Town	ME	7624
Orient	ME	151
Orland	ME	2219
Orono	ME	9474
Orrington	ME	3666
Otis	ME	565
Owls Head	ME	1665
Oxbow	ME	58
Oxford	ME	1263
Palermo	ME	1268
Palmyra	ME	2031
Paris	ME	5073
Parkman	ME	843
Parsonsfield	ME	1647
Passadumkeag	ME	459
Patten	ME	1155
Pembroke	ME	914
Penobscot	ME	1397
Perham	ME	451
Perry	ME	881
Peru	ME	1575
Phillips	ME	1029
Phippsburg	ME	2190
Pittsfield	ME	3150
Pittston	ME	2649
Plymouth	ME	1307
Poland	ME	5314
Porter	ME	1495
Portland	ME	66881
Prentiss	ME	222
Presque Isle	ME	9171
Princeton	ME	927
Prospect	ME	667
Randolph	ME	1772
Rangeley	ME	128
Raymond	ME	4649
Readfield	ME	2454
Reed	ME	215
Richmond	ME	1760
Robbinston	ME	546
Rockland	ME	7237
Rockport	ME	3336
Rome	ME	1019
Roque Bluffs	ME	274
Roxbury	ME	399
Rumford	ME	4218
Sabattus	ME	4694
Saco	ME	19078
Saint Agatha	ME	834
Saint Albans	ME	1909
Saint Francis	ME	600
Saint George	ME	2682
Saint John	ME	293
Sandy River	ME	97
Sanford	ME	20893
Sangerville	ME	1320
Scarborough	ME	4403
Searsmont	ME	1221
Searsport	ME	992
Sebec	ME	636
Seboeis	ME	43
Sedgwick	ME	1146
Shapleigh	ME	2418
Sherman	ME	974
Sidney	ME	3653
Skowhegan	ME	6297
Smithfield	ME	967
Solon	ME	977
Somerville	ME	529
Sorrento	ME	302
South Berwick	ME	7480
South Bristol	ME	933
South Eliot	ME	3550
South Paris	ME	2267
South Portland	ME	25556
South Portland Gardens	ME	23893
South Sanford	ME	4536
South Thomaston	ME	1472
South Windham	ME	1374
Southport	ME	711
Southwest Harbor	ME	720
Springfield	ME	394
Springvale	ME	3292
Stacyville	ME	421
Standish	ME	469
Starks	ME	601
Steep Falls	ME	1139
Stetson	ME	1020
Steuben	ME	1171
Stockholm	ME	282
Stockton Springs	ME	1540
Stonington	ME	1198
Stow	ME	299
Strong	ME	1309
Sullivan	ME	1232
Sumner	ME	888
Surry	ME	1415
Swans Island	ME	340
Swanville	ME	1411
Temple	ME	595
The Forks	ME	36
Thomaston	ME	1875
Thorndike	ME	740
Topsfield	ME	234
Topsham	ME	5931
Tremont	ME	1590
Trenton	ME	1424
Troy	ME	1001
Turner	ME	5470
Union	ME	2297
Unity	ME	469
Upton	ME	64
Van Buren	ME	1937
Vanceboro	ME	153
Vassalboro	ME	4208
Veazie	ME	1813
Verona	ME	554
Vienna	ME	548
Vinalhaven	ME	1284
Waite	ME	109
Waldo	ME	762
Waldoboro	ME	1233
Wallagrass	ME	583
Waltham	ME	318
Warren	ME	3945
Washburn	ME	997
Washington	ME	1398
Waterboro	ME	7532
Waterville	ME	16261
Wayne	ME	1156
Webster	ME	85
Weld	ME	418
Wellington	ME	268
Wells Beach Station	ME	10162
Wesley	ME	119
West Forks	ME	49
West Kennebunk	ME	1176
West Paris	ME	1790
West Scarborough	ME	27706
Westbrook	ME	17978
Westfield	ME	581
Weston	ME	211
Westport	ME	775
Whitefield	ME	2363
Whiting	ME	447
Whitneyville	ME	272
Willimantic	ME	140
Wilton	ME	2198
Windsor	ME	2291
Winn	ME	437
Winslow	ME	7794
Winter Harbor	ME	426
Winterport	ME	1340
Winterville	ME	204
Winthrop	ME	2650
Wiscasset	ME	1097
Woodland	ME	952
Woodstock	ME	1352
Woolwich	ME	2922
Wyman	ME	73
Yarmouth	ME	5869
York Beach	ME	12854
York Harbor	ME	3033
Addison	MI	594
Adrian	MI	20691
Advance	MI	328
Ahmeek	MI	146
Akron	MI	393
Alanson	MI	746
Alba	MI	295
Albion	MI	8229
Alden	MI	125
Algonac	MI	4055
Allegan	MI	5071
Allen	MI	189
Allen Park	MI	27425
Allendale	MI	17579
Alma	MI	9193
Almont	MI	2723
Alpena	MI	10175
Alpha	MI	138
Amasa	MI	283
Ann Arbor	MI	117070
Applegate	MI	240
Arcadia	MI	291
Argentine	MI	2525
Armada	MI	1744
Ashley	MI	555
Athens	MI	1007
Atlanta	MI	827
Atlantic Mine	MI	2082
Attica	MI	994
Au Gres	MI	859
Au Sable	MI	1404
Auburn	MI	2113
Auburn Hills	MI	22672
Augusta	MI	904
Avoca	MI	1200
Bad Axe	MI	3011
Baldwin	MI	1159
Bancroft	MI	522
Bangor	MI	1850
Baraga	MI	1996
Barnes Lake	MI	0
Barnes Lake-Millers Lake	MI	1093
Baroda	MI	850
Barryton	MI	357
Barton Hills	MI	301
Bath	MI	2083
Battle Creek	MI	51589
Bay	MI	0
Bay City	MI	33917
Bay Harbor	MI	5749
Bay Port	MI	477
Bay Shore	MI	754
Bay View	MI	133
Beal	MI	0
Beal City	MI	357
Bear Lake	MI	282
Beaverton	MI	1049
Beecher	MI	10232
Beechwood	MI	3015
Belding	MI	5769
Bellaire	MI	1065
Belleville	MI	3880
Bellevue	MI	1278
Belmont	MI	9244
Bendon	MI	208
Benton Harbor	MI	9976
Benton Heights	MI	4084
Benzonia	MI	491
Bergland	MI	0
Berkley	MI	15268
Berrien Springs	MI	1764
Bessemer	MI	1770
Beulah	MI	341
Beverly Hills	MI	10267
Big Bay	MI	319
Big Rapids	MI	10397
Bingham Farms	MI	1133
Birch Run	MI	1479
Birmingham	MI	20857
Blissfield	MI	3255
Bloomfield Hills	MI	4004
Bloomingdale	MI	442
Boon	MI	167
Boyne	MI	0
Boyne City	MI	3776
Boyne Falls	MI	295
Breckenridge	MI	1305
Breedsville	MI	197
Brethren	MI	410
Bridgeport	MI	6950
Bridgman	MI	2258
Brighton	MI	7609
Brimley	MI	0
Britton	MI	569
Bronson	MI	2335
Brooklyn	MI	1198
Brown	MI	0
Brown City	MI	1274
Brownlee Park	MI	2108
Bruce Crossing	MI	0
Brutus	MI	218
Buchanan	MI	4362
Buckley	MI	705
Buena Vista	MI	6816
Burlington	MI	257
Burr Oak	MI	819
Burt	MI	1228
Burton	MI	28788
Byron	MI	558
Byron Center	MI	5822
Caberfae	MI	0
Cadillac	MI	10373
Caledonia	MI	1590
Calumet	MI	703
Cambria	MI	0
Camden	MI	504
Canada Creek Ranch	MI	304
Canadian Lakes	MI	2756
Cannonsburg	MI	0
Canton	MI	86825
Capac	MI	1849
Carleton	MI	2338
Carney	MI	189
Caro	MI	4099
Carp Lake	MI	357
Carrollton	MI	6583
Carson	MI	0
Carson City	MI	1090
Carsonville	MI	511
Caseville	MI	744
Casnovia	MI	327
Caspian	MI	868
Cass	MI	0
Cass City	MI	2357
Cassopolis	MI	1729
Cedar	MI	93
Cedar Springs	MI	3624
Cement	MI	0
Cement City	MI	426
Center Line	MI	8320
Central Lake	MI	935
Centreville	MI	1415
Charlevoix	MI	2540
Charlotte	MI	9054
Chassell	MI	0
Chatham	MI	212
Cheboygan	MI	4733
Chelsea	MI	5205
Chesaning	MI	2288
Chums Corner	MI	946
Clare	MI	3082
Clarkston	MI	1035
Clarksville	MI	399
Clawson	MI	12015
Clayton	MI	339
Clifford	MI	325
Climax	MI	781
Clinton	MI	2272
Clinton Township	MI	99753
Clio	MI	2536
Coldwater	MI	10844
Coleman	MI	1205
Coloma	MI	1455
Colon	MI	1159
Columbiaville	MI	782
Comstock Northwest	MI	5455
Comstock Park	MI	10088
Concord	MI	1050
Constantine	MI	2064
Conway	MI	204
Coopersville	MI	4351
Copemish	MI	192
Copper	MI	0
Copper City	MI	187
Copper Harbor	MI	108
Corunna	MI	3404
Covington	MI	0
Cross	MI	0
Cross Village, Harbor Springs	MI	93
Croswell	MI	2338
Crystal	MI	0
Crystal Downs Country Club	MI	0
Crystal Falls	MI	1414
Crystal Mountain	MI	0
Custer	MI	285
Cutlerville	MI	14370
Daggett	MI	254
Dansville	MI	556
Davison	MI	4965
De Tour	MI	0
De Tour Village	MI	321
Dearborn	MI	95171
Dearborn Heights	MI	56145
Decatur	MI	1767
Deckerville	MI	801
Deerfield	MI	873
Delton	MI	872
Detroit	MI	645705
Detroit Beach	MI	2087
DeWitt	MI	4655
Dexter	MI	4067
Dimondale	MI	1245
Dodgeville	MI	0
Dollar Bay	MI	1082
Dorr	MI	0
Douglas	MI	1284
Dowagiac	MI	5851
Dowling	MI	374
Dryden	MI	941
Dundee	MI	3994
Durand	MI	3338
Eagle	MI	123
Eagle Harbor	MI	76
Eagle River	MI	71
East Grand Rapids	MI	11311
East Jordan	MI	2371
East Lake	MI	466
East Lansing	MI	48471
East Tawas	MI	2747
Eastlake	MI	0
Eastpointe	MI	32657
Eastport	MI	218
Eastwood	MI	6340
Eaton Rapids	MI	5225
Eau Claire	MI	618
Ecorse	MI	9257
Edgemont Park	MI	2358
Edmore	MI	1196
Edwardsburg	MI	1227
Elberta	MI	369
Elk Rapids	MI	1615
Elkton	MI	779
Ellsworth	MI	342
Elm Hall	MI	0
Elsie	MI	971
Emmett	MI	263
Empire	MI	379
Escanaba	MI	12334
Essexville	MI	3396
Estral Beach	MI	408
Eureka	MI	0
Evart	MI	1861
Ewen	MI	0
Fair Plain	MI	7631
Fairgrove	MI	543
Falmouth	MI	0
Farmington	MI	10523
Farmington Hills	MI	81330
Farwell	MI	858
Fennville	MI	1400
Fenton	MI	11442
Ferndale	MI	20177
Ferrysburg	MI	2993
Fife Lake	MI	456
Filer	MI	0
Filer City	MI	116
Flat Rock	MI	9914
Flint	MI	98310
Flushing	MI	8086
Forest Hills	MI	25867
Forestville	MI	132
Fostoria	MI	694
Fountain	MI	194
Fowler	MI	1225
Fowlerville	MI	2895
Frankenmuth	MI	5025
Frankfort	MI	1283
Franklin	MI	3237
Fraser	MI	14636
Free Soil	MI	144
Freeland	MI	6969
Freeport	MI	483
Fremont	MI	4036
Fruitport	MI	1111
Fulton	MI	0
Gaastra	MI	332
Gagetown	MI	379
Gaines	MI	369
Galesburg	MI	2043
Galien	MI	532
Garden	MI	217
Garden City	MI	26920
Gaylord	MI	3660
Gibraltar	MI	4531
Gladstone	MI	4830
Gladwin	MI	2880
Glen Arbor	MI	229
Gobles	MI	808
Goodrich	MI	1831
Grand Beach	MI	277
Grand Blanc	MI	7993
Grand Haven	MI	11062
Grand Ledge	MI	7791
Grand Marais	MI	0
Grand Rapids	MI	195097
Grandville	MI	15953
Grant	MI	882
Grass Lake	MI	1166
Grawn	MI	772
Grayling	MI	1844
Greenland	MI	0
Greenville	MI	8444
Greilickville	MI	1530
Grosse Ile	MI	11361
Grosse Pointe	MI	5232
Grosse Pointe Farms	MI	9232
Grosse Pointe Park	MI	11220
Grosse Pointe Shores	MI	2718
Grosse Pointe Woods	MI	15762
Gwinn	MI	1917
Hamtramck	MI	22002
Hancock	MI	4555
Hanover	MI	431
Harbor Beach	MI	1634
Harbor Springs	MI	1201
Hardwood Acres	MI	432
Haring	MI	328
Harper Woods	MI	13836
Harrietta	MI	144
Harrison	MI	2107
Harrisville	MI	470
Hart	MI	2098
Hartford	MI	2617
Hartland	MI	0
Harvey	MI	1393
Haslett	MI	19220
Hastings	MI	7284
Hazel Park	MI	16597
Hemlock	MI	1466
Henderson	MI	399
Hermansville	MI	0
Hersey	MI	347
Hesperia	MI	938
Hickory Corners	MI	322
Highland Park	MI	10949
Hillman	MI	669
Hillsdale	MI	8163
Holland	MI	33742
Holly	MI	6169
Holt	MI	23973
Homer	MI	1630
Honor	MI	324
Hopkins	MI	608
Horton Bay	MI	512
Houghton	MI	7970
Houghton Lake	MI	3427
Howard	MI	0
Howard City	MI	1792
Howell	MI	9521
Hubbard Lake	MI	1002
Hubbardston	MI	400
Hubbell	MI	946
Hudson	MI	2241
Hudsonville	MI	7324
Huntington Woods	MI	6340
Hurontown	MI	0
Ida	MI	0
Imlay	MI	0
Imlay City	MI	3573
Indian River	MI	1959
Inkster	MI	24672
Interlochen	MI	583
Ionia	MI	11372
Iron Mountain	MI	7504
Iron River	MI	2904
Ironton	MI	140
Ironwood	MI	5002
Ishpeming	MI	6483
Ithaca	MI	2834
Jackson	MI	33133
Jasper	MI	412
Jenison	MI	16538
Jennings	MI	264
Jonesville	MI	2220
K. I. Sawyer	MI	0
K. I. Sawyer Air Force Base	MI	2624
Kalamazoo	MI	76041
Kaleva	MI	464
Kalkaska	MI	2038
Keego Harbor	MI	3029
Kent	MI	0
Kent City	MI	1102
Kentwood	MI	51357
Kilmanagh	MI	2944
Kincheloe	MI	0
Kinde	MI	432
Kingsford	MI	5069
Kingsley	MI	1559
Kingston	MI	430
L'Anse	MI	1934
Laingsburg	MI	1277
Lake	MI	0
Lake Angelus	MI	297
Lake Ann	MI	265
Lake City	MI	843
Lake Fenton	MI	5559
Lake Gogebic	MI	0
Lake Isabella	MI	1652
Lake LeAnn	MI	0
Lake Leelanau	MI	253
Lake Linden	MI	989
Lake Michigan Beach	MI	1216
Lake Odessa	MI	2029
Lake Orion	MI	3051
Lake Victoria	MI	0
Lakeport	MI	0
Lakes of the North	MI	0
Lakeview	MI	1115
Lakewood Club	MI	1288
Lambertville	MI	9953
Lamont	MI	0
Lansing	MI	112644
Lapeer	MI	8790
Lathrup	MI	0
Lathrup Village	MI	4135
Laurium	MI	1941
Lawrence	MI	987
Lawton	MI	1866
Le Roy	MI	252
Leland	MI	377
Lennon	MI	501
Leonard	MI	410
Leslie	MI	1866
Level Park-Oak Park	MI	3409
Levering	MI	215
Lewiston	MI	1392
Lexington	MI	1128
Lincoln	MI	319
Lincoln Park	MI	37012
Linden	MI	3839
Litchfield	MI	1347
Livonia	MI	94635
Loomis	MI	213
Lost Lake Woods	MI	312
Lowell	MI	3906
Ludington	MI	8058
Luna Pier	MI	1389
Lupton	MI	348
Luther	MI	316
Lyons	MI	793
Mackinac Island	MI	481
Mackinaw	MI	0
Mackinaw City	MI	802
Madison Heights	MI	30198
Mancelona	MI	1365
Manchester	MI	2143
Manistee	MI	6084
Manistee Lake	MI	0
Manistique	MI	2982
Manitou Beach-Devils Lake	MI	2019
Manton	MI	1371
Maple	MI	0
Maple City	MI	207
Maple Grove	MI	132
Maple Rapids	MI	678
Marcellus	MI	1157
Marenisco	MI	254
Marine	MI	0
Marine City	MI	4143
Marion	MI	852
Marlette	MI	1801
Marquette	MI	21297
Marshall	MI	7045
Martin	MI	417
Marysville	MI	9757
Mason	MI	8427
Mass	MI	0
Mattawan	MI	1947
Maybee	MI	545
Mayville	MI	920
McBain	MI	661
McBride	MI	206
Mears	MI	0
Mecosta	MI	453
Melvin	MI	174
Melvindale	MI	10404
Memphis	MI	1182
Mendon	MI	861
Menominee	MI	8382
Merrill	MI	746
Mesick	MI	398
Metamora	MI	566
Michiana	MI	183
Michigamme	MI	271
Michigan Center	MI	4672
Middletown	MI	897
Middleville	MI	3301
Midland	MI	42200
Milan	MI	5983
Milford	MI	6472
Millburg	MI	0
Millers Lake	MI	0
Millersburg	MI	198
Millington	MI	1037
Minden	MI	0
Minden City	MI	191
Mineral Hills, Iron River	MI	219
Mio	MI	1826
Mohawk	MI	0
Monroe	MI	20092
Montague	MI	2362
Montgomery	MI	338
Montrose	MI	1587
Morenci	MI	2187
Morley	MI	496
Morrice	MI	897
Mount Clemens	MI	16400
Mount Morris	MI	2964
Mount Pleasant	MI	26060
Muir	MI	605
Mulliken	MI	558
Munising	MI	2288
Muskegon	MI	38401
Muskegon Heights	MI	10796
Napoleon	MI	1258
Nashville	MI	1633
Naubinway	MI	0
Negaunee	MI	4582
Nessen	MI	0
Nessen City	MI	97
New Baltimore	MI	12354
New Buffalo	MI	1876
New Era	MI	445
New Haven	MI	5123
New Lothrop	MI	561
New Troy	MI	497
Newaygo	MI	1957
Newberry	MI	1455
Niles	MI	11333
North Adams	MI	472
North Branch	MI	1029
North Muskegon	MI	3779
Northport	MI	531
Northview	MI	14541
Northville	MI	6010
Norton Shores	MI	24208
Norway	MI	2798
Norwood	MI	142
Novi	MI	58723
Nunica	MI	0
Oak Hill	MI	569
Oak Park	MI	29752
Oakley	MI	278
Oden	MI	363
Okemos	MI	21369
Olivet	MI	1610
Omena	MI	267
Omer	MI	299
Onaway	MI	841
Onekama	MI	406
Onsted	MI	904
Ontonagon	MI	1324
Orchard Lake	MI	2245
Ortonville	MI	1463
Oscoda	MI	903
Ossineke	MI	938
Otisville	MI	825
Otsego	MI	3991
Otter Lake	MI	388
Ovid	MI	1612
Owendale	MI	232
Owosso	MI	14699
Oxford	MI	3534
Painesdale	MI	0
Palmer	MI	418
Palo	MI	0
Parchment	MI	1848
Paris	MI	0
Parkdale	MI	704
Parma	MI	760
Paw Paw	MI	3455
Paw Paw Lake	MI	3511
Pearl Beach	MI	2829
Peck	MI	613
Pelkie	MI	0
Pellston	MI	829
Pentwater	MI	845
Perrinton	MI	399
Perry	MI	2100
Petersburg	MI	1131
Petoskey	MI	5719
Pewamo	MI	476
Pierson	MI	173
Pigeon	MI	1166
Pilgrim	MI	11
Pinckney	MI	2436
Pinconning	MI	1271
Pittsford	MI	0
Plainwell	MI	3822
Pleasant Ridge	MI	2556
Plymouth	MI	8905
Ponshewaing	MI	69
Pontiac	MI	59917
Port Austin	MI	642
Port Hope	MI	257
Port Huron	MI	29330
Port Sanilac	MI	604
Portage	MI	48177
Portland	MI	3923
Posen	MI	225
Potterville	MI	2618
Powers	MI	418
Prescott	MI	257
Presque Isle Harbor	MI	0
Prudenville	MI	1682
Quincy	MI	1640
Quinnesec	MI	1191
Ramsay	MI	0
Rapid	MI	0
Rapid City	MI	1352
Rapid River	MI	0
Ravenna	MI	1213
Reading	MI	1056
Redford	MI	49936
Reed	MI	0
Reed City	MI	2390
Reese	MI	1408
Republic	MI	570
Richland	MI	786
Richmond	MI	5864
River Rouge	MI	7546
Riverdale	MI	0
Riverview	MI	12181
Robin Glen-Indiantown	MI	722
Rochester	MI	12993
Rochester Hills	MI	73424
Rock	MI	0
Rockford	MI	6134
Rockland	MI	0
Rockwood	MI	3199
Rogers	MI	0
Rogers City	MI	2712
Romeo	MI	3625
Romulus	MI	23417
Roosevelt Park	MI	3821
Roscommon	MI	1061
Rose	MI	0
Rose City	MI	633
Rosebush	MI	366
Roseville	MI	47637
Rothbury	MI	424
Royal Oak	MI	59008
Ruby	MI	0
Saginaw	MI	49347
Saginaw Township North	MI	24994
Saint Charles	MI	2054
Saint Clair	MI	5485
Saint Clair Shores	MI	59715
Saint Helen	MI	2668
Saint Ignace	MI	2452
Saint James	MI	205
Saint Johns	MI	7865
Saint Joseph	MI	8365
Saint Louis	MI	7482
Saline	MI	9100
Sand Lake	MI	1412
Sandusky	MI	2596
Sanford	MI	849
Saranac	MI	1333
Saugatuck	MI	964
Sault Ste. Marie	MI	13827
Schoolcraft	MI	1566
Scotts	MI	0
Scottville	MI	1213
Sebewaing	MI	1692
Shaftsburg	MI	0
Shelby	MI	74099
Shepherd	MI	1507
Sheridan	MI	652
Sherwood	MI	310
Shields	MI	6587
Shoreham	MI	850
Shorewood-Tower Hills-Harbert	MI	1344
Skanee	MI	0
Skidway Lake	MI	3392
Snover	MI	448
South Boardman	MI	536
South Gull Lake	MI	1182
South Haven	MI	4359
South Lyon	MI	11722
South Monroe	MI	6433
South Range	MI	746
South Rockwood	MI	1642
Southfield	MI	73156
Southgate	MI	29293
Sparta	MI	4311
Spring Arbor	MI	2881
Spring Lake	MI	2480
Springfield	MI	5192
Springport	MI	790
St. Charles	MI	0
St. Clair	MI	0
St. Clair Shores	MI	0
St. Helen	MI	0
St. Ignace	MI	0
St. James	MI	0
St. Johns	MI	0
St. Joseph	MI	0
St. Louis	MI	0
Stambaugh, Iron River	MI	1215
Standish	MI	1452
Stanton	MI	1414
Stanwood	MI	212
Stephenson	MI	867
Sterling	MI	513
Sterling Heights	MI	132052
Stevensville	MI	1119
Stockbridge	MI	1232
Stony Point	MI	1849
Stronach	MI	162
Sturgis	MI	10896
Sunfield	MI	583
Suttons Bay	MI	626
Swartz Creek	MI	5567
Sylvan Lake	MI	1785
Tawas	MI	0
Tawas City	MI	1786
Taylor	MI	61568
Tecumseh	MI	8372
Tekonsha	MI	704
Temperance	MI	8517
Thompsonville	MI	435
Three Lakes	MI	0
Three Oaks	MI	1579
Three Rivers	MI	7752
Tower	MI	0
Traverse	MI	0
Traverse City	MI	15218
Trenton	MI	18380
Trimountain	MI	0
Trowbridge Park	MI	2176
Troy	MI	83280
Trufant	MI	0
Turner	MI	110
Tustin	MI	226
Twin Lake	MI	1720
Twining	MI	175
Ubly	MI	828
Union	MI	0
Union City	MI	1584
Unionville	MI	496
Utica	MI	4942
Vandalia	MI	296
Vanderbilt	MI	564
Vandercook Lake	MI	4721
Vassar	MI	2620
Vermontville	MI	761
Vernon	MI	758
Vicksburg	MI	3230
Village of Clarkston	MI	0
Village of Grosse Pointe Shores	MI	0
Vineyard Lake	MI	0
Wacousta	MI	1440
Wakefield	MI	1725
Waldron	MI	532
Walker	MI	24647
Walkerville	MI	242
Walled Lake	MI	7110
Walloon Lake	MI	290
Warren	MI	134056
Waterford	MI	75737
Watersmeet	MI	428
Watervliet	MI	1692
Waverly	MI	23925
Wayland	MI	4166
Wayne	MI	17081
Webberville	MI	1274
Wedgewood	MI	237
Weidman	MI	959
Wellston	MI	311
West Bloomfield Township	MI	64690
West Branch	MI	2067
West Ishpeming	MI	2662
West Monroe	MI	3503
Westland	MI	82000
Westphalia	MI	937
Westwood	MI	8653
White Cloud	MI	1383
White Pigeon	MI	1514
White Pine	MI	474
Whitehall	MI	2711
Whitmore Lake	MI	6423
Whittemore	MI	375
Williamston	MI	3883
Winn	MI	0
Wixom	MI	13746
Wolf Lake	MI	4104
Wolverine	MI	237
Wolverine Lake	MI	4312
Woodhaven	MI	12539
Woodland	MI	425
Woodland Beach	MI	2049
Wyandotte	MI	25156
Wyoming	MI	75275
Yale	MI	1905
Ypsilanti	MI	19945
Zeba	MI	480
Zeeland	MI	5626
Zilwaukee	MI	1577
Ada	MN	1656
Adams	MN	779
Adrian	MN	1220
Afton	MN	2966
Aitkin	MN	2053
Akeley	MN	431
Albany	MN	2647
Albert Lea	MN	17674
Alberta	MN	102
Albertville	MN	7345
Alden	MN	646
Aldrich	MN	47
Alexandria	MN	11843
Alpha	MN	125
Altura	MN	489
Alvarado	MN	356
Amboy	MN	522
Andover	MN	32213
Angle Inlet	MN	60
Annandale	MN	3304
Anoka	MN	17350
Apple Valley	MN	51221
Appleton	MN	1341
Arco	MN	73
Arden Hills	MN	9951
Argyle	MN	642
Arlington	MN	2169
Arnold	MN	2960
Ashby	MN	431
Askov	MN	351
Atwater	MN	1124
Audubon	MN	510
Aurora	MN	1666
Austin	MN	24563
Avoca	MN	140
Avon	MN	1466
Babbitt	MN	1519
Backus	MN	246
Badger	MN	372
Bagley	MN	1394
Baker	MN	55
Balaton	MN	624
Ball Club	MN	342
Barnesville	MN	2577
Barnum	MN	598
Barrett	MN	401
Barry	MN	15
Battle Lake	MN	880
Baudette	MN	1063
Baxter	MN	7934
Bayport	MN	3714
Beardsley	MN	222
Beaulieu	MN	48
Beaver Bay	MN	174
Beaver Creek	MN	296
Becker	MN	4700
Bejou	MN	90
Belgrade	MN	755
Belle Plaine	MN	6918
Bellechester	MN	175
Bellingham	MN	159
Beltrami	MN	106
Belview	MN	363
Bemidji	MN	14594
Bena	MN	118
Benson	MN	3240
Bertha	MN	471
Bethel	MN	472
Big Falls	MN	224
Big Lake	MN	10368
Bigelow	MN	238
Bigfork	MN	445
Bingham Lake	MN	126
Birchwood	MN	1139
Bird Island	MN	994
Biscay	MN	111
Biwabik	MN	992
Blackduck	MN	779
Blaine	MN	62124
Blomkest	MN	161
Blooming Prairie	MN	1993
Bloomington	MN	86435
Blue Earth	MN	3236
Bluffton	MN	210
Bock	MN	105
Borup	MN	107
Bovey	MN	811
Bowlus	MN	283
Boy River	MN	46
Boyd	MN	166
Braham	MN	1770
Brainerd	MN	13371
Branch	MN	2696
Brandon	MN	476
Breckenridge	MN	3290
Breezy Point	MN	2350
Brewster	MN	472
Bricelyn	MN	346
Brook Park	MN	136
Brooklyn Center	MN	30770
Brooklyn Park	MN	79149
Brooks	MN	141
Brookston	MN	139
Brooten	MN	745
Browerville	MN	757
Browns Valley	MN	557
Brownsdale	MN	684
Brownsville	MN	465
Brownton	MN	738
Bruno	MN	100
Buckman	MN	271
Buffalo	MN	16026
Buffalo Lake	MN	690
Buhl	MN	990
Burnsville	MN	61481
Burtrum	MN	140
Butterfield	MN	594
Byron	MN	5328
Caledonia	MN	2787
Callaway	MN	235
Calumet	MN	359
Cambridge	MN	8451
Campbell	MN	154
Canby	MN	1709
Cannon Falls	MN	4062
Canton	MN	345
Carlos	MN	490
Carlton	MN	1048
Carver	MN	4311
Cass Lake	MN	747
Cedar Mills	MN	44
Center	MN	0
Center City	MN	628
Centerville	MN	3930
Ceylon	MN	356
Champlin	MN	23894
Chandler	MN	257
Chanhassen	MN	25332
Chaska	MN	25199
Chatfield	MN	2799
Chickamaw Beach	MN	113
Chisago	MN	0
Chisago City	MN	4932
Chisholm	MN	4981
Chokio	MN	389
Circle Pines	MN	4958
Clara	MN	0
Clara City	MN	1320
Claremont	MN	536
Clarissa	MN	655
Clarkfield	MN	811
Clarks Grove	MN	681
Clear Lake	MN	645
Clearbrook	MN	517
Clearwater	MN	1783
Clements	MN	149
Cleveland	MN	700
Climax	MN	265
Clinton	MN	419
Clitherall	MN	114
Clontarf	MN	157
Cloquet	MN	12075
Coates	MN	163
Cobden	MN	35
Cohasset	MN	2745
Cokato	MN	2727
Cold Spring	MN	4094
Coleraine	MN	1999
Collegeville	MN	3516
Cologne	MN	1605
Columbia Heights	MN	19715
Columbus	MN	4007
Comfrey	MN	372
Comstock	MN	93
Conger	MN	143
Cook	MN	567
Coon Rapids	MN	62240
Corcoran	MN	5552
Correll	MN	32
Cosmos	MN	458
Cottage Grove	MN	35918
Cottonwood	MN	1212
Courtland	MN	653
Credit River	MN	0
Cromwell	MN	230
Crookston	MN	7787
Crosby	MN	2345
Crosslake	MN	2141
Crown College	MN	0
Crystal	MN	22943
Currie	MN	227
Cuyuna	MN	346
Cyrus	MN	283
Dakota	MN	317
Dalton	MN	253
Danube	MN	470
Danvers	MN	93
Darfur	MN	106
Darwin	MN	352
Dassel	MN	1437
Dawson	MN	1444
Dayton	MN	5096
De Graff	MN	127
Deephaven	MN	3843
Deer Creek	MN	323
Deer River	MN	933
Deerwood	MN	520
Delano	MN	5875
Delavan	MN	174
Delhi	MN	46
Dellwood	MN	1094
Denham	MN	34
Dennison	MN	213
Dent	MN	192
Detroit Lakes	MN	9002
Dexter	MN	341
Dilworth	MN	4366
Dodge Center	MN	2690
Donaldson	MN	41
Donnelly	MN	241
Doran	MN	53
Dover	MN	745
Dovray	MN	54
Dresbach	MN	0
Duluth	MN	86110
Dumont	MN	95
Dundas	MN	1481
Dundee	MN	70
Dunnell	MN	161
Eagan	MN	66286
Eagle Bend	MN	510
Eagle Lake	MN	2841
East Bethel	MN	11692
East Grand Forks	MN	8643
East Gull Lake	MN	1011
Easton	MN	193
Ebro	MN	64
Echo	MN	263
Eden Prairie	MN	63496
Eden Valley	MN	1036
Edgerton	MN	1139
Edina	MN	50138
Effie	MN	123
Eitzen	MN	242
Elba	MN	155
Elbow Lake	MN	1144
Elgin	MN	1055
Elizabeth	MN	173
Elk River	MN	23963
Elko	MN	542
Elko New Market	MN	4705
Elkton	MN	141
Ellendale	MN	691
Ellsworth	MN	460
Elmdale	MN	113
Elmore	MN	637
Elrosa	MN	213
Ely	MN	3408
Elysian	MN	669
Emily	MN	829
Emmons	MN	383
Empire	MN	0
Erhard	MN	148
Erskine	MN	487
Esko	MN	1869
Essig	MN	0
Evan	MN	83
Evansville	MN	601
Eveleth	MN	3673
Excelsior	MN	2279
Eyota	MN	2032
Fairfax	MN	1172
Fairhaven	MN	358
Fairmont	MN	10221
Falcon Heights	MN	5571
Faribault	MN	23650
Farmington	MN	22731
Farwell	MN	52
Federal Dam	MN	106
Felton	MN	179
Fergus Falls	MN	13281
Fertile	MN	841
Fifty Lakes	MN	397
Finland	MN	195
Finlayson	MN	311
Fish Lake	MN	0
Fisher	MN	434
Flensburg	MN	227
Floodwood	MN	522
Florence	MN	38
Foley	MN	2656
Forada	MN	191
Forest Lake	MN	19618
Foreston	MN	516
Fort Ripley	MN	69
Fosston	MN	1498
Fountain	MN	408
Foxhome	MN	113
Franklin	MN	478
Frazee	MN	1371
Freeborn	MN	291
Freeport	MN	659
Fridley	MN	27713
Frontenac	MN	282
Frost	MN	192
Fulda	MN	1243
Funkley	MN	5
Garden	MN	0
Garden City	MN	255
Garfield	MN	343
Garrison	MN	201
Garvin	MN	135
Gary	MN	209
Gaylord	MN	2245
Gem Lake	MN	469
Geneva	MN	544
Genola	MN	75
Georgetown	MN	129
Ghent	MN	367
Gibbon	MN	752
Gilbert	MN	1792
Gilman	MN	224
Glencoe	MN	5521
Glenville	MN	630
Glenwood	MN	2568
Glyndon	MN	1380
Golden Valley	MN	21270
Gonvick	MN	287
Good Thunder	MN	578
Goodhue	MN	1174
Goodland	MN	0
Goodridge	MN	132
Goodview	MN	4144
Graceville	MN	555
Granada	MN	293
Grand Marais	MN	1327
Grand Meadow	MN	1149
Grand Rapids	MN	11127
Granite Falls	MN	2747
Grant	MN	4147
Grasston	MN	155
Green Isle	MN	537
Greenbush	MN	733
Greenfield	MN	2919
Greenwald	MN	224
Greenwood	MN	718
Grey Eagle	MN	332
Grove	MN	0
Grove City	MN	616
Grygla	MN	218
Gully	MN	66
Hackensack	MN	313
Hadley	MN	58
Hallock	MN	953
Halma	MN	59
Halstad	MN	575
Ham Lake	MN	16062
Hamburg	MN	520
Hammond	MN	134
Hampton	MN	687
Hancock	MN	755
Hanley Falls	MN	288
Hanover	MN	3289
Hanska	MN	377
Harding	MN	126
Hardwick	MN	195
Harmony	MN	994
Harris	MN	1125
Hartland	MN	309
Hastings	MN	22554
Hatfield	MN	57
Hawley	MN	2179
Hayfield	MN	1320
Hayward	MN	245
Hazel Run	MN	60
Hector	MN	1076
Heidelberg	MN	123
Henderson	MN	874
Hendricks	MN	691
Hendrum	MN	300
Henning	MN	798
Henriette	MN	69
Herman	MN	429
Hermantown	MN	9706
Heron Lake	MN	676
Hewitt	MN	248
Hibbing	MN	16204
High Forest	MN	0
Hill	MN	0
Hill City	MN	600
Hillman	MN	37
Hills	MN	673
Hilltop	MN	744
Hinckley	MN	1806
Hitterdal	MN	201
Hoffman	MN	672
Hokah	MN	560
Holdingford	MN	713
Holland	MN	180
Hollandale	MN	297
Holloway	MN	88
Holt	MN	88
Homer	MN	181
Hopkins	MN	17591
Houston	MN	966
Howard Lake	MN	2039
Hoyt Lakes	MN	2004
Hubbard	MN	0
Hugo	MN	14388
Humboldt	MN	44
Hutchinson	MN	13913
Ihlen	MN	61
Independence	MN	3741
Inger	MN	212
International Falls	MN	6158
Inver Grove Heights	MN	34857
Iona	MN	131
Iron Junction	MN	86
Ironton	MN	561
Isanti	MN	5464
Island View	MN	150
Isle	MN	788
Ivanhoe	MN	550
Jackson	MN	3234
Janesville	MN	2254
Jasper	MN	615
Jeffers	MN	356
Jenkins	MN	443
Johnson	MN	28
Jordan	MN	6076
Kandiyohi	MN	490
Karlstad	MN	733
Kasota	MN	660
Kasson	MN	6123
Keewatin	MN	1049
Kelliher	MN	259
Kellogg	MN	432
Kennedy	MN	188
Kenneth	MN	67
Kensington	MN	291
Kent	MN	79
Kenyon	MN	1814
Kerkhoven	MN	717
Kerrick	MN	64
Kettle River	MN	179
Kiester	MN	478
Kilkenny	MN	133
Kimball	MN	774
Kinbrae	MN	12
Kingston	MN	159
Kinney	MN	169
Knife River	MN	0
Kragnes	MN	319
La Crescent	MN	4826
La Prairie	MN	659
La Salle	MN	85
Lafayette	MN	489
Lake	MN	0
Lake Benton	MN	657
Lake Bronson	MN	223
Lake City	MN	5027
Lake Crystal	MN	2527
Lake Elmo	MN	8406
Lake George	MN	230
Lake Henry	MN	104
Lake Lillian	MN	238
Lake Park	MN	779
Lake Saint Croix Beach	MN	1051
Lake Shore	MN	1023
Lake St. Croix Beach	MN	0
Lake Wilson	MN	239
Lakefield	MN	1656
Lakeland	MN	1839
Lakeland Shores	MN	314
Lakeville	MN	60633
Lamberton	MN	791
Lancaster	MN	331
Landfall	MN	735
Lanesboro	MN	734
Lansing	MN	181
Laporte	MN	114
Lastrup	MN	102
Lauderdale	MN	2506
Le Center	MN	2459
Le Roy	MN	921
Le Sueur	MN	3999
Lengby	MN	85
Leonard	MN	42
Leonidas	MN	52
Leota	MN	209
Lester Prairie	MN	1686
Lewiston	MN	1571
Lewisville	MN	245
Lexington	MN	2049
Lilydale	MN	872
Lindstrom	MN	4401
Lino Lakes	MN	21050
Lismore	MN	230
Litchfield	MN	6657
Little Canada	MN	10319
Little Falls	MN	8649
Little Rock	MN	1208
Littlefork	MN	622
Long Beach	MN	412
Long Lake	MN	1800
Long Prairie	MN	3347
Longfellow Community	MN	29295
Longville	MN	157
Lonsdale	MN	3843
Loretto	MN	668
Louisburg	MN	44
Lowry	MN	298
Lucan	MN	184
Luella Anderson Subdivision	MN	600
Lutsen	MN	190
Luverne	MN	4677
Lyle	MN	542
Lynd	MN	442
Mabel	MN	760
Madelia	MN	2250
Madison	MN	1462
Madison Lake	MN	1094
Magnolia	MN	219
Mahnomen	MN	1222
Mahtomedi	MN	8116
Mahtowa	MN	370
Manchester	MN	56
Manhattan Beach	MN	58
Mankato	MN	41044
Mantorville	MN	1200
Maple Grove	MN	68385
Maple Lake	MN	2092
Maple Plain	MN	1785
Mapleton	MN	1731
Mapleview	MN	176
Maplewood	MN	40567
Marble	MN	693
Marietta	MN	153
Marine on Saint Croix	MN	689
Marine on St. Croix	MN	0
Marion	MN	0
Marshall	MN	13652
Martin Lake	MN	933
Mayer	MN	1903
Maynard	MN	351
Mazeppa	MN	822
McGrath	MN	77
McGregor	MN	367
McIntosh	MN	618
McKinley	MN	128
Meadowlands	MN	134
Medford	MN	1249
Medicine Lake	MN	371
Medina	MN	5973
Meire Grove	MN	181
Melrose	MN	3616
Menahga	MN	1339
Mendota	MN	205
Mendota Heights	MN	11223
Mentor	MN	152
Merrifield	MN	140
Middle River	MN	296
Midway	MN	0
Miesville	MN	131
Milaca	MN	2883
Milan	MN	360
Millerville	MN	105
Millville	MN	177
Milroy	MN	245
Miltona	MN	431
Minneapolis	MN	410939
Minneiska	MN	108
Minneota	MN	1363
Minnesota	MN	0
Minnesota City	MN	200
Minnesota Lake	MN	662
Minnetonka	MN	51669
Minnetonka Beach	MN	570
Minnetonka Mills	MN	50117
Minnetrista	MN	7178
Mizpah	MN	54
Montevideo	MN	5217
Montgomery	MN	2915
Monticello	MN	13299
Montrose	MN	3079
Moorhead	MN	42005
Moose Lake	MN	2748
Mora	MN	3462
Morgan	MN	867
Morris	MN	5352
Morristown	MN	992
Morton	MN	382
Motley	MN	646
Mound	MN	9336
Mounds View	MN	12914
Mountain Iron	MN	2880
Mountain Lake	MN	2117
Murdock	MN	266
Myrtle	MN	47
Nashua	MN	66
Nashwauk	MN	968
Nassau	MN	68
Naytahwaush	MN	578
Nelson	MN	186
Nerstrand	MN	299
Nett Lake	MN	284
Nevis	MN	401
New Auburn	MN	437
New Brighton	MN	22351
New Germany	MN	389
New Hope	MN	21032
New London	MN	1328
New Market	MN	700
New Munich	MN	326
New Prague	MN	7582
New Richland	MN	1188
New Trier	MN	113
New Ulm	MN	13327
New York Mills	MN	1225
Newfolden	MN	373
Newport	MN	3480
Nicollet	MN	1138
Nielsville	MN	89
Nimrod	MN	68
Nisswa	MN	2011
Norcross	MN	69
North Branch	MN	10215
North Mankato	MN	13529
North Oaks	MN	4968
North Redwood	MN	204
North Saint Paul	MN	11460
North St. Paul	MN	0
Northfield	MN	20380
Northome	MN	194
Northrop	MN	219
Norwood (historical)	MN	1506
Norwood Young America	MN	3677
Nowthen	MN	4582
Oak Grove	MN	8439
Oak Park Heights	MN	4831
Oakdale	MN	28080
Oakport	MN	1387
Odessa	MN	129
Odin	MN	104
Ogema	MN	185
Ogilvie	MN	352
Okabena	MN	184
Oklee	MN	424
Olivia	MN	2356
Onamia	MN	864
Ormsby	MN	128
Orono	MN	8006
Oronoco	MN	1446
Orr	MN	335
Ortonville	MN	1815
Osage	MN	323
Osakis	MN	1719
Oslo	MN	320
Osseo	MN	2748
Ostrander	MN	254
Otsego	MN	15551
Ottertail	MN	602
Owatonna	MN	25725
Palisade	MN	159
Park Rapids	MN	3947
Parkers Prairie	MN	1005
Parkville	MN	2525
Paynesville	MN	2433
Pease	MN	240
Pelican Rapids	MN	2461
Pemberton	MN	248
Pennock	MN	515
Pequot Lakes	MN	2243
Perham	MN	3278
Perley	MN	90
Peterson	MN	199
Pickwick	MN	157
Pierz	MN	1362
Pillager	MN	453
Pine	MN	0
Pine Bend	MN	28
Pine City	MN	3078
Pine Island	MN	3337
Pine Point	MN	338
Pine River	MN	927
Pine Springs	MN	396
Pipestone	MN	4141
Plainview	MN	3237
Plato	MN	317
Pleasant Lake	MN	623
Plummer	MN	293
Plymouth	MN	75907
Ponemah	MN	724
Porter	MN	179
Preston	MN	1299
Princeton	MN	4680
Prinsburg	MN	496
Prior Lake	MN	25282
Proctor	MN	3068
Quamba	MN	128
Racine	MN	515
Ramsey	MN	25828
Randall	MN	624
Randolph	MN	441
Ranier	MN	586
Raymond	MN	756
Red Lake	MN	1731
Red Lake Falls	MN	1406
Red Wing	MN	16445
Redby	MN	1334
Redwood Falls	MN	5061
Regal	MN	34
Remer	MN	362
Renville	MN	1213
Revere	MN	92
Rice	MN	1361
Rice Lake	MN	236
Richfield	MN	36216
Richmond	MN	1435
Richville	MN	96
Riverland	MN	276
Riverton	MN	116
Robbinsdale	MN	14418
Rochester	MN	112225
Rock Creek	MN	1600
Rockford	MN	4358
Rockville	MN	2514
Rogers	MN	12562
Rollingstone	MN	657
Ronneby	MN	67
Roosevelt	MN	153
Roscoe	MN	103
Rose Creek	MN	399
Roseau	MN	2715
Rosemount	MN	23413
Roseville	MN	35580
Rothsay	MN	485
Round Lake	MN	371
Roy Lake	MN	12
Royalton	MN	1215
Rush	MN	0
Rush City	MN	3072
Rushford	MN	1712
Rushford Village	MN	808
Rushmore	MN	336
Russell	MN	333
Ruthton	MN	233
Rutledge	MN	221
Sabin	MN	551
Sacred Heart	MN	518
Saint Anthony	MN	8226
Saint Augusta	MN	3317
Saint Bonifacius	MN	2283
Saint Charles	MN	3735
Saint Clair	MN	868
Saint Cloud	MN	65842
Saint Francis	MN	7218
Saint Hilaire	MN	279
Saint James	MN	4605
Saint Joseph	MN	6534
Saint Leo	MN	100
Saint Louis Park	MN	45250
Saint Martin	MN	308
Saint Marys Point	MN	368
Saint Michael	MN	16399
Saint Paul	MN	303176
Saint Paul Park	MN	5279
Saint Peter	MN	11196
Saint Rosa	MN	68
Saint Stephen	MN	851
Saint Vincent	MN	64
Sanborn	MN	318
Sandstone	MN	2768
Sargeant	MN	61
Sartell	MN	16788
Sauk Centre	MN	4357
Sauk Rapids	MN	13424
Savage	MN	30391
Scandia	MN	4057
Scanlon	MN	979
Seaforth	MN	83
Searles	MN	171
Sebeka	MN	692
Sedan	MN	44
Shafer	MN	1036
Shakopee	MN	39981
Shelly	MN	187
Sherburn	MN	1089
Shevlin	MN	179
Shoreview	MN	26477
Shorewood	MN	7614
Silver Bay	MN	1813
Silver Creek	MN	256
Silver Lake	MN	812
Skyline	MN	293
Slayton	MN	2053
Sleepy Eye	MN	3443
Sobieski	MN	190
Solway	MN	97
Soudan	MN	446
South End	MN	0
South Haven	MN	191
South Saint Paul	MN	20160
South St. Paul	MN	0
Spicer	MN	1196
Spring Grove	MN	1293
Spring Hill	MN	86
Spring Lake Park	MN	6473
Spring Park	MN	1705
Spring Valley	MN	2413
Springfield	MN	2068
Squaw Lake	MN	107
St. Anthony	MN	0
St. Augusta	MN	0
St. Bonifacius	MN	0
St. Charles	MN	0
St. Clair	MN	0
St. Cloud	MN	0
St. Francis	MN	0
St. Hilaire	MN	0
St. James	MN	0
St. John's University	MN	0
St. Joseph	MN	0
St. Leo	MN	0
St. Louis Park	MN	0
St. Martin	MN	0
St. Marys Point	MN	0
St. Michael	MN	0
St. Paul	MN	0
St. Paul Park	MN	0
St. Peter	MN	0
St. Rosa	MN	0
St. Stephen	MN	0
St. Vincent	MN	0
Stacy	MN	1470
Stanchfield	MN	118
Staples	MN	2885
Starbuck	MN	1264
Steen	MN	178
Stephen	MN	655
Stewart	MN	550
Stewartville	MN	6037
Stillwater	MN	18924
Stockton	MN	721
Storden	MN	217
Strandquist	MN	69
Strathcona	MN	45
Sturgeon Lake	MN	427
Sunburg	MN	102
Sunfish Lake	MN	538
Swanville	MN	342
Taconite	MN	642
Tamarack	MN	89
Taopi	MN	58
Taunton	MN	137
Taylors Falls	MN	1014
Tenney	MN	5
Tenstrike	MN	205
The Lakes	MN	667
The Ranch	MN	9
Thief River Falls	MN	8752
Thomson	MN	159
Tintah	MN	60
Tonka Bay	MN	1537
Tower	MN	496
Tracy	MN	2117
Trail	MN	46
Trimont	MN	715
Trommald	MN	101
Trosky	MN	83
Truman	MN	1069
Turtle River	MN	78
Twin Lakes	MN	148
Twin Valley	MN	798
Two Harbors	MN	3578
Tyler	MN	1110
Ulen	MN	551
Underwood	MN	336
Upsala	MN	423
Urbank	MN	54
Utica	MN	286
Vadnais Heights	MN	13266
Vergas	MN	345
Vermillion	MN	424
Verndale	MN	583
Vernon Center	MN	329
Vesta	MN	307
Victoria	MN	8676
Viking	MN	104
Village of Minnetonka Beach	MN	0
Villard	MN	250
Vineland	MN	1001
Vining	MN	78
Virginia	MN	8587
Wabasha	MN	2451
Wabasso	MN	670
Waconia	MN	11968
Wadena	MN	4176
Wahkon	MN	209
Waite Park	MN	7517
Waldorf	MN	227
Walker	MN	928
Walnut Grove	MN	828
Walters	MN	71
Waltham	MN	151
Wanamingo	MN	1081
Wanda	MN	81
Warba	MN	181
Warren	MN	1563
Warroad	MN	1799
Warsaw	MN	627
Waseca	MN	9241
Watertown	MN	4289
Waterville	MN	1849
Watkins	MN	942
Watson	MN	200
Waubun	MN	397
Waverly	MN	1396
Wayzata	MN	4610
Welcome	MN	659
Wells	MN	2247
Wendell	MN	165
West Concord	MN	774
West Coon Rapids	MN	62528
West Roy Lake	MN	0
West Saint Paul	MN	19540
West St. Paul	MN	0
West Union	MN	123
Westbrook	MN	726
Westport	MN	56
Whalan	MN	67
Wheaton	MN	1362
Whipholt	MN	99
White Bear Lake	MN	25205
White Earth	MN	580
Wilder	MN	61
Willernie	MN	496
Williams	MN	185
Willmar	MN	19638
Willow River	MN	396
Wilmont	MN	345
Wilton	MN	273
Windom	MN	4550
Winger	MN	218
Winnebago	MN	1378
Winona	MN	27094
Winsted	MN	2296
Winthrop	MN	1363
Winton	MN	172
Wolf Lake	MN	57
Wolverton	MN	138
Wood Lake	MN	405
Woodbury	MN	67855
Woodland	MN	463
Woodstock	MN	120
Worthington	MN	13090
Wrenshall	MN	407
Wright	MN	126
Wykoff	MN	431
Wyoming	MN	7813
Young America (historical)	MN	1530
Zemple	MN	93
Zimmerman	MN	5350
Zumbro Falls	MN	243
Zumbrota	MN	3365
Adrian	MO	1622
Advance	MO	1366
Affton	MO	20307
Agency	MO	672
Airport Drive	MO	844
Alba	MO	539
Albany	MO	1791
Aldrich	MO	80
Alexandria	MO	153
Allendale	MO	51
Allenville	MO	119
Alma	MO	394
Altamont	MO	200
Altenburg	MO	351
Alton	MO	877
Amazonia	MO	307
Amity	MO	53
Amoret	MO	184
Amsterdam	MO	235
Anderson	MO	1982
Annada	MO	29
Annapolis	MO	345
Anniston	MO	226
Appleton	MO	0
Appleton City	MO	1092
Arbela	MO	42
Arbyrd	MO	486
Arcadia	MO	575
Archie	MO	1201
Arcola	MO	53
Argyle	MO	160
Arkoe	MO	65
Armstrong	MO	287
Arnold	MO	21357
Arrow Point	MO	88
Arrow Rock	MO	58
Asbury	MO	205
Ash Grove	MO	1466
Ashburn	MO	52
Ashland	MO	3865
Ashley	MO	90
Atlanta	MO	374
Augusta	MO	255
Aullville	MO	98
Aurora	MO	7477
Aurora Springs	MO	0
Auxvasse	MO	985
Ava	MO	2934
Avalon	MO	0
Avilla	MO	124
Avondale	MO	459
Bagnell	MO	95
Baker	MO	3
Bakersfield	MO	237
Baldwin Park	MO	92
Ballwin	MO	30577
Baring	MO	126
Barnard	MO	212
Barnett	MO	201
Barnhart	MO	5682
Bates	MO	0
Bates City	MO	220
Battlefield	MO	6001
Bel-Nor	MO	1482
Bel-Ridge	MO	2722
Bell	MO	0
Bell City	MO	436
Bella Villa	MO	729
Belle	MO	1528
Bellefontaine Neighbors	MO	10798
Bellerive	MO	189
Bellerive Acres	MO	0
Bellflower	MO	364
Belton	MO	23168
Bennett Springs	MO	130
Bent Tree Harbor	MO	0
Benton	MO	863
Benton City	MO	105
Berger	MO	220
Berkeley	MO	9073
Bernie	MO	1951
Bertrand	MO	792
Bethany	MO	3149
Bethel	MO	118
Beverly Hills	MO	566
Bevier	MO	703
Biehle	MO	48
Big Lake	MO	145
Big Spring	MO	167
Bigelow	MO	25
Billings	MO	1083
Birch Tree	MO	662
Birmingham	MO	193
Bismarck	MO	1500
Black Jack	MO	6947
Blackburn	MO	250
Blackwater	MO	163
Blairstown	MO	95
Blanchard	MO	0
Bland	MO	522
Blodgett	MO	0
Blodgett, Sandywoods Township	MO	213
Bloomfield	MO	1903
Bloomsdale	MO	529
Blue Eye	MO	0
Blue Springs	MO	54148
Blue Summit	MO	0
Blythedale	MO	187
Bogard	MO	160
Bolckow	MO	188
Bolivar	MO	10714
Bonne Terre	MO	7133
Boonville	MO	8403
Bosworth	MO	297
Bourbon	MO	1621
Bowling Green	MO	5388
Bragg	MO	0
Bragg City	MO	143
Brandsville	MO	160
Branson	MO	11431
Branson West	MO	440
Brashear	MO	268
Braymer	MO	848
Breckenridge	MO	358
Breckenridge Hills	MO	4715
Brentwood	MO	8057
Brewer	MO	374
Briarwood Estates	MO	0
Bridgeton	MO	11786
Brimson	MO	62
Bronaugh	MO	247
Brookfield	MO	4358
Brookline	MO	367
Brooklyn Heights	MO	100
Broseley	MO	0
Browning	MO	256
Brownington	MO	105
Brumley	MO	93
Brunswick	MO	830
Bucklin	MO	446
Buckner	MO	3067
Buell	MO	0
Buffalo	MO	3040
Bull Creek	MO	595
Bunceton	MO	348
Bunker	MO	400
Burfordville	MO	0
Burgess	MO	55
Burlington Junction	MO	506
Butler	MO	4091
Butterfield	MO	465
Byrnes Mill	MO	2888
Cabool	MO	2130
Cainsville	MO	280
Cairo	MO	205
Caledonia	MO	130
Calhoun	MO	450
California	MO	4396
Callao	MO	281
Calverton Park	MO	1293
Camden	MO	186
Camden Point	MO	526
Camdenton	MO	3880
Cameron	MO	9836
Campbell	MO	1922
Canalou	MO	314
Canton	MO	2377
Cape Girardeau	MO	39462
Cardwell	MO	687
Carl Junction	MO	7729
Carrollton	MO	3638
Carterville	MO	1852
Carthage	MO	14319
Caruthersville	MO	5930
Carytown	MO	269
Cassville	MO	3306
Castle Point	MO	3962
Catron	MO	64
Cave	MO	5
Cedar Hill	MO	1721
Cedar Hill Lakes	MO	239
Center	MO	506
Centertown	MO	275
Centerview	MO	270
Centerville	MO	188
Centralia	MO	4194
Chaffee	MO	2943
Chain of Rocks	MO	97
Chain-O-Lakes	MO	132
Chamois	MO	385
Champ	MO	13
Charlack	MO	1371
Charleston	MO	5815
Charmwood	MO	32
Cherokee Pass	MO	235
Chesapeake	MO	49
Chesterfield	MO	47864
Chilhowee	MO	329
Chillicothe	MO	9487
Chula	MO	203
Clarence	MO	781
Clark	MO	296
Clarksburg	MO	334
Clarksdale	MO	268
Clarkson Valley	MO	2652
Clarksville	MO	431
Clarkton	MO	1231
Claycomo	MO	1468
Clayton	MO	15884
Clearmont	MO	163
Cleveland	MO	663
Clever	MO	2517
Cliff	MO	0
Cliff Village	MO	40
Clifton Hill	MO	113
Climax Springs	MO	124
Clinton	MO	8899
Clyde	MO	79
Cobalt	MO	0
Cobalt Village	MO	226
Coffey	MO	163
Cole Camp	MO	1105
Collins	MO	155
Columbia	MO	129330
Commerce	MO	67
Conception	MO	210
Conception Junction	MO	189
Concord	MO	16421
Concordia	MO	2390
Coney Island	MO	69
Connelsville	MO	0
Conway	MO	777
Cool Valley	MO	1187
Cooter	MO	442
Corder	MO	397
Corning	MO	14
Cosby	MO	125
Cottleville	MO	4723
Country Club	MO	0
Country Club Hills	MO	1272
Country Club Village	MO	2449
Country Life Acres	MO	74
Cowgill	MO	180
Craig	MO	248
Crane	MO	1352
Creighton	MO	344
Crestwood	MO	11966
Creve Coeur	MO	18276
Crocker	MO	1071
Cross Timbers	MO	210
Crystal	MO	0
Crystal City	MO	4847
Crystal Lake Park	MO	499
Crystal Lakes	MO	348
Cuba	MO	3374
Curryville	MO	226
Dadeville	MO	227
Dalton	MO	17
Danville	MO	34
Dardenne Prairie	MO	12890
Darlington	MO	121
Dawn	MO	128
De Kalb	MO	219
De Soto	MO	6495
De Witt	MO	121
Dearborn	MO	506
Deepwater	MO	355
Deerfield	MO	80
Deering	MO	0
Defiance	MO	155
Dellwood	MO	5011
Delta	MO	440
Dennis Acres	MO	77
Denton	MO	0
Denver	MO	37
Des Arc	MO	166
Des Peres	MO	8572
Desloge	MO	4939
Dexter	MO	7992
Diamond	MO	925
Diehlstadt	MO	160
Diggins	MO	308
Dixon	MO	1499
Doe Run	MO	915
Doniphan	MO	1991
Doolittle	MO	605
Dover	MO	101
Downing	MO	336
Drexel	MO	956
Dudley	MO	232
Duenweg	MO	1306
Duquesne	MO	1736
Dutchtown	MO	96
Eagle Rock	MO	199
Eagleville	MO	305
East Independence	MO	110675
East Lynne	MO	304
East Prairie	MO	3155
Easton	MO	238
Edgar Springs	MO	203
Edgerton	MO	575
Edina	MO	1108
Edinburg	MO	92
Edmundson	MO	837
El Dorado Springs	MO	3564
Eldon	MO	4632
Ellington	MO	960
Ellisville	MO	9284
Ellsinore	MO	449
Elmer	MO	79
Elmira	MO	49
Elmo	MO	161
Elsberry	MO	1986
Elvins	MO	1480
Emerald Beach	MO	231
Eminence	MO	587
Emma	MO	238
Eolia	MO	512
Essex	MO	460
Esther	MO	1161
Ethel	MO	61
Eugene	MO	156
Eureka	MO	10602
Evergreen	MO	28
Everton	MO	303
Ewing	MO	454
Excello	MO	49
Excelsior Estates	MO	135
Excelsior Springs	MO	11486
Exeter	MO	775
Fair Grove	MO	1459
Fair Play	MO	466
Fairdealing	MO	676
Fairfax	MO	594
Fairview	MO	381
Farber	MO	318
Farley	MO	284
Farmington	MO	18181
Faucett	MO	0
Fayette	MO	2702
Fenton	MO	4052
Ferguson	MO	21059
Ferrelview	MO	462
Festus	MO	12065
Fidelity	MO	259
Fillmore	MO	185
Fisk	MO	339
Flat River	MO	5157
Fleming	MO	124
Flemington	MO	148
Flint Hill	MO	522
Flordell Hills	MO	814
Florida	MO	0
Florissant	MO	52268
Foley	MO	167
Ford City	MO	29
Fordland	MO	815
Forest	MO	0
Forest City	MO	253
Foristell	MO	520
Forsyth	MO	2431
Fort Leonard Wood	MO	15061
Fortescue	MO	30
Fortuna	MO	0
Foster	MO	113
Fountain N' Lakes	MO	162
Four Seasons	MO	2217
Frankclay	MO	221
Frankford	MO	321
Franklin	MO	96
Fredericktown	MO	4076
Freeburg	MO	429
Freeman	MO	484
Freistatt	MO	162
Fremont	MO	129
Fremont Hills	MO	867
Friedenswald	MO	0
Frisbee	MO	0
Frohna	MO	258
Frontenac	MO	3574
Fulton	MO	12939
Gainesville	MO	760
Galena	MO	409
Gallatin	MO	1744
Galt	MO	250
Garden	MO	0
Garden City	MO	1625
Gasconade	MO	214
Gentry	MO	72
Gerald	MO	1318
Gerster	MO	24
Gibbs	MO	105
Gideon	MO	1041
Gifford	MO	72
Gilliam	MO	198
Gilman	MO	0
Gilman City	MO	364
Ginger Blue	MO	61
Gladstone	MO	26861
Glasgow	MO	1103
Glasgow Village	MO	5429
Glen Allen	MO	0
Glen Echo Park	MO	160
Glenaire	MO	578
Glenallen	MO	85
Glendale	MO	5927
Glenwood	MO	198
Golden	MO	280
Golden City	MO	729
Goodman	MO	1248
Goodnight	MO	18
Goose Creek Lake	MO	0
Gordonville	MO	400
Gorin	MO	127
Goss	MO	0
Gower	MO	1501
Graham	MO	164
Grain Valley	MO	13379
Granby	MO	2128
Grand Falls Plaza	MO	115
Grand Pass	MO	66
Grandin	MO	297
Grandview	MO	25256
Granger	MO	34
Grant	MO	0
Grant City	MO	812
Grantwood	MO	0
Grantwood Village	MO	866
Gravois Mills	MO	143
Gray Summit	MO	2701
Grayhawk	MO	0
Grayridge	MO	127
Grayson	MO	0
Green	MO	0
Green Castle	MO	274
Green City	MO	618
Green Park	MO	2640
Green Ridge	MO	491
Greendale	MO	653
Greenfield	MO	1316
Greentop	MO	443
Greenville	MO	490
Greenwood	MO	5569
Grovespring	MO	0
Guilford	MO	85
Gunn	MO	0
Gunn City	MO	118
Hale	MO	407
Halfway	MO	173
Hallsville	MO	1551
Halltown	MO	172
Hamilton	MO	1711
Hanley Hills	MO	2126
Hannibal	MO	17839
Hardin	MO	542
Harris	MO	58
Harrisburg	MO	275
Harrisonville	MO	9986
Hartsburg	MO	104
Hartville	MO	596
Hartwell	MO	16
Harviell	MO	106
Harwood	MO	47
Hawk Point	MO	682
Hayti	MO	2787
Hayti Heights	MO	590
Hayward	MO	131
Haywood	MO	0
Haywood City	MO	204
Hazelwood	MO	25661
Henrietta	MO	460
Herculaneum	MO	3935
Hermann	MO	2376
Hermitage	MO	458
Higbee	MO	554
Higginsville	MO	4662
High Hill	MO	185
High Ridge	MO	4305
Highlandville	MO	958
Hillsboro	MO	3076
Hillsdale	MO	1513
Hoberg	MO	56
Holcomb	MO	607
Holden	MO	2263
Holland	MO	220
Holliday	MO	133
Hollister	MO	4499
Hollywood	MO	0
Holt	MO	471
Holts Summit	MO	3600
Homestead	MO	184
Homestown	MO	145
Hopkins	MO	499
Horine	MO	821
Hornersville	MO	635
Houston	MO	2082
Houston Lake	MO	244
Houstonia	MO	221
Howardville	MO	367
Hughesville	MO	184
Humansville	MO	1038
Hume	MO	326
Humphreys	MO	113
Hunnewell	MO	179
Hunter	MO	168
Huntleigh	MO	335
Huntsdale	MO	31
Huntsville	MO	1524
Hurdland	MO	155
Hurley	MO	169
Iantha	MO	0
Iatan	MO	47
Iberia	MO	743
Imperial	MO	4709
Independence	MO	117255
Indian Lake	MO	0
Indian Point	MO	515
Innsbrook	MO	582
Ionia	MO	87
Irena	MO	17
Iron Gates	MO	332
Iron Mountain Lake	MO	717
Irondale	MO	445
Ironton	MO	1392
Irwin	MO	69
Jackson	MO	14869
Jacksonville	MO	172
Jameson	MO	133
Jamesport	MO	507
Jamestown	MO	391
Jane	MO	297
Jasper	MO	928
Jefferson	MO	0
Jefferson City	MO	42595
Jennings	MO	14819
Jerico Springs	MO	229
Jonesburg	MO	729
Joplin	MO	51818
Josephville	MO	389
Junction	MO	0
Junction City	MO	327
Kahoka	MO	2024
Kaiser	MO	456
Kansas	MO	0
Kansas City	MO	475378
Kearney	MO	9423
Kelso	MO	603
Kennett	MO	10662
Keytesville	MO	455
Kidder	MO	309
Kimberling	MO	0
Kimberling City	MO	2313
Kimmswick	MO	158
King	MO	0
King City	MO	1006
Kingdom	MO	0
Kingdom City	MO	130
Kingston	MO	338
Kingsville	MO	269
Kinloch	MO	299
Kirbyville	MO	213
Kirksville	MO	17520
Kirkwood	MO	27750
Kissee Mills	MO	1109
Knob Lick	MO	147
Knob Noster	MO	2762
Knox	MO	0
Knox City	MO	206
Koshkonong	MO	213
La Belle	MO	657
La Due	MO	28
La Grange	MO	939
La Monte	MO	1134
La Plata	MO	1336
La Russell	MO	113
La Tour	MO	0
LaBarque Creek	MO	1558
Laclede	MO	327
Laddonia	MO	510
Ladue	MO	8597
Lake Annette	MO	100
Lake Arrowhead	MO	0
Lake Lafayette	MO	323
Lake Lotawana	MO	2018
Lake Mykee Town	MO	355
Lake Ozark	MO	1761
Lake Saint Louis	MO	14545
Lake St. Clair	MO	0
Lake St. Louis	MO	0
Lake Tapawingo	MO	724
Lake Tekakwitha	MO	0
Lake Timberline	MO	0
Lake Viking	MO	0
Lake Waukomis	MO	902
Lake Winnebago	MO	1144
Lakeland	MO	376
Lakeshire	MO	1428
Lakeside	MO	0
Lakeview	MO	111
Lamar	MO	4361
Lamar Heights	MO	172
Lambert	MO	34
Lanagan	MO	412
Lancaster	MO	724
Laredo	MO	196
Latham	MO	0
Lathrop	MO	2049
Latour	MO	93
Laurie	MO	932
Lawson	MO	2409
Leadington	MO	450
Leadwood	MO	1236
Leasburg	MO	334
Leawood	MO	676
Lebanon	MO	14688
Lee's Summit	MO	95094
Leeton	MO	563
Leisure Lake	MO	0
Lemay	MO	16645
Leonard	MO	59
Leslie	MO	169
Levasy	MO	83
Lewis and Clark	MO	0
Lewis and Clark Village	MO	132
Lewistown	MO	529
Lexington	MO	4598
Liberal	MO	721
Liberty	MO	30450
Licking	MO	3115
Lilbourn	MO	1137
Lincoln	MO	1173
Linn	MO	1429
Linn Creek	MO	244
Linneus	MO	270
Lithium	MO	89
Livonia	MO	73
Loch Lloyd	MO	704
Lock Springs	MO	56
Lockwood	MO	905
Lohman	MO	161
Loma Linda	MO	784
Lon	MO	78
Lone Jack	MO	1124
Longtown	MO	103
Louisburg	MO	121
Louisiana	MO	3296
Lowry	MO	0
Lowry City	MO	624
Lucerne	MO	83
Ludlow	MO	132
Lupus	MO	34
Luray	MO	95
Mackenzie	MO	134
Macks Creek	MO	244
Macon	MO	5436
Madison	MO	535
Maitland	MO	309
Malden	MO	4121
Malta Bend	MO	251
Manchester	MO	18229
Mansfield	MO	1261
Maplewood	MO	7945
Marble Hill	MO	1482
Marceline	MO	2154
Marionville	MO	2189
Marlborough	MO	2191
Marquand	MO	208
Marshall	MO	13039
Marshfield	MO	7138
Marston	MO	477
Marthasville	MO	1152
Martinsburg	MO	308
Maryland Heights	MO	27389
Maryville	MO	11879
Matthews	MO	628
Maysville	MO	1094
Mayview	MO	208
McBaine	MO	10
McCord Bend	MO	275
McFall	MO	93
McKittrick	MO	58
Meadville	MO	449
Medill	MO	0
Mehlville	MO	28380
Memphis	MO	1829
Mendon	MO	167
Mercer	MO	312
Merriam Woods	MO	1763
Merwin	MO	56
Meta	MO	227
Metz	MO	49
Mexico	MO	11660
Miami	MO	175
Middle Grove	MO	0
Middletown	MO	159
Milan	MO	1852
Milford	MO	26
Mill Spring	MO	183
Millard	MO	87
Miller	MO	686
Millersville	MO	0
Milo	MO	89
Mindenmines	MO	346
Mine La Motte	MO	348
Miner	MO	961
Mineral Point	MO	347
Miramiguoa Park	MO	119
Missouri	MO	0
Missouri City	MO	280
Moberly	MO	13919
Mokane	MO	187
Moline Acres	MO	2431
Monett	MO	8988
Monroe	MO	0
Monroe City	MO	2446
Montgomery	MO	0
Montgomery City	MO	2734
Monticello	MO	99
Montier	MO	98
Montreal	MO	0
Montrose	MO	370
Mooresville	MO	88
Morehouse	MO	925
Morley	MO	687
Morrison	MO	137
Morrisville	MO	385
Mosby	MO	198
Moscow Mills	MO	2567
Mound	MO	0
Mound City	MO	1059
Moundville	MO	123
Mount Leonard	MO	87
Mount Moriah	MO	84
Mount Vernon	MO	4537
Mountain Grove	MO	4685
Mountain View	MO	2673
Murphy	MO	8690
Napoleon	MO	218
Naylor	MO	615
Neck	MO	0
Neck City	MO	184
Neelyville	MO	471
Nelson	MO	193
Neosho	MO	12156
Nevada	MO	8253
New Bloomfield	MO	676
New Cambria	MO	194
New Florence	MO	728
New Franklin	MO	1082
New Hamburg	MO	0
New Hampton	MO	281
New Haven	MO	2096
New London	MO	969
New Madrid	MO	3011
New Market	MO	0
New Melle	MO	494
New Wells	MO	0
Newark	MO	90
Newburg	MO	452
Newtonia	MO	200
Newtown	MO	175
Niangua	MO	411
Nixa	MO	20984
Noel	MO	1824
Norborne	MO	679
Normandy	MO	4978
North Kansas	MO	0
North Kansas City	MO	4354
North Lilbourn	MO	47
North Wardell	MO	172
Northmoor	MO	325
Northwoods	MO	4193
Norwood	MO	641
Norwood Court	MO	959
Novelty	MO	133
Novinger	MO	438
O'Fallon	MO	85040
Oak Grove	MO	7937
Oak Grove Village	MO	489
Oak Ridge	MO	249
Oakland	MO	1382
Oakland Park	MO	95
Oaks	MO	135
Oakview	MO	391
Oakville	MO	36143
Oakwood	MO	195
Oakwood Park	MO	196
Odessa	MO	5178
Old Appleton	MO	87
Old Jamestown	MO	19184
Old Monroe	MO	282
Olean	MO	130
Olivette	MO	7870
Olympian	MO	0
Olympian Village	MO	765
Oran	MO	1277
Oregon	MO	776
Oronogo	MO	2425
Orrick	MO	809
Osage Beach	MO	4433
Osborn	MO	413
Osceola	MO	915
Osgood	MO	46
Otterville	MO	451
Overland	MO	15959
Owensville	MO	2627
Oxly	MO	200
Ozark	MO	19120
Ozora	MO	183
Pacific	MO	7161
Pagedale	MO	3312
Palmyra	MO	3616
Paradise	MO	0
Paris	MO	1176
Park Hills	MO	8692
Parkdale	MO	170
Parkville	MO	6296
Parkway	MO	437
Parma	MO	665
Parnell	MO	183
Pasadena Hills	MO	923
Pasadena Park	MO	461
Pascola	MO	104
Passaic	MO	33
Pattonsburg	MO	344
Paynesville	MO	77
Peaceful	MO	0
Peculiar	MO	4885
Peerless Park	MO	42
Pendleton	MO	44
Penermon	MO	64
Perkins	MO	0
Perry	MO	696
Perryville	MO	8398
Pevely	MO	5652
Phelps	MO	0
Phelps City	MO	24
Philadelphia	MO	0
Phillipsburg	MO	202
Pickering	MO	153
Piedmont	MO	1977
Pierce	MO	0
Pierce City	MO	1279
Pierpont	MO	77
Pilot Grove	MO	761
Pilot Knob	MO	713
Pine Lawn	MO	3419
Pineville	MO	786
Pinhook	MO	30
Plato	MO	109
Platte	MO	0
Platte City	MO	4833
Platte Woods	MO	400
Plattsburg	MO	2291
Pleasant Hill	MO	8289
Pleasant Hope	MO	614
Pleasant Valley	MO	3056
Plevna	MO	21
Pocahontas	MO	117
Pollock	MO	85
Polo	MO	540
Pomona	MO	511
Pontiac	MO	175
Poplar Bluff	MO	17266
Portage Des Sioux	MO	332
Portageville	MO	3146
Potosi	MO	2640
Powersville	MO	59
Prairie Hill	MO	0
Prairie Home	MO	282
Prathersville	MO	128
Preston	MO	217
Princeton	MO	1133
Purcell	MO	397
Purdin	MO	185
Purdy	MO	1103
Puxico	MO	871
Queen	MO	0
Queen City	MO	593
Quitman	MO	43
Qulin	MO	453
Raintree	MO	0
Randolph	MO	54
Ravanna	MO	98
Ravenwood	MO	411
Raymondville	MO	362
Raymore	MO	20374
Raytown	MO	29401
Rayville	MO	223
Rea	MO	50
Redings Mill	MO	152
Reeds	MO	94
Reeds Spring	MO	865
Renick	MO	171
Rensselaer	MO	231
Republic	MO	16005
Revere	MO	76
Rhineland	MO	135
Rich Hill	MO	1336
Richards	MO	96
Richland	MO	1826
Richmond	MO	5595
Richmond Heights	MO	8481
Ridgely	MO	111
Ridgeway	MO	448
Rington	MO	250
Risco	MO	328
Ritchey	MO	83
River Bend	MO	10
Rivermines	MO	484
Riverside	MO	3150
Riverview	MO	3014
Riverview Estates	MO	82
Rives	MO	61
Rocheport	MO	249
Rock Hill	MO	4646
Rock Port	MO	1232
Rockaway Beach	MO	866
Rockville	MO	161
Rocky Comfort	MO	0
Rogersville	MO	3374
Rolla	MO	20019
Roscoe	MO	121
Rosebud	MO	407
Rosendale	MO	143
Rothville	MO	97
Rush Hill	MO	151
Rushville	MO	276
Russellville	MO	802
Rutledge	MO	110
Saddlebrooke	MO	234
Saginaw	MO	308
Saint Ann	MO	13020
Saint Charles	MO	65794
Saint Clair	MO	4724
Saint Clement	MO	78
Saint Cloud	MO	41
Saint Elizabeth	MO	336
Saint Francisville	MO	179
Saint George	MO	1337
Saint James	MO	4216
Saint John	MO	6584
Saint Johns	MO	7690
Saint Joseph	MO	76780
Saint Martins	MO	1140
Saint Mary	MO	360
Saint Paul	MO	1829
Saint Peters	MO	52575
Saint Robert	MO	4340
Saint Thomas	MO	263
Sainte Genevieve	MO	4410
Salem	MO	4992
Salisbury	MO	1561
Sappington	MO	7580
Sarcoxie	MO	1301
Savannah	MO	5108
Saverton	MO	0
Schell	MO	0
Schell City	MO	247
Scotsdale	MO	224
Scott	MO	0
Scott City	MO	4526
Sedalia	MO	21516
Sedgewickville	MO	172
Seligman	MO	841
Senath	MO	1711
Seneca	MO	2397
Seymour	MO	1967
Shakertowne	MO	0
Shawneetown	MO	0
Shelbina	MO	1639
Shelbyville	MO	526
Sheldon	MO	532
Shell Knob	MO	1379
Sheridan	MO	186
Shoal Creek Drive	MO	337
Shoal Creek Estates	MO	97
Shrewsbury	MO	6254
Sibley	MO	356
Sikeston	MO	16436
Silex	MO	283
Silver Creek	MO	623
Skidmore	MO	272
Slater	MO	1832
Smithton	MO	564
Smithville	MO	9233
South Fork	MO	241
South Gifford	MO	0
South Gorin	MO	0
South Greenfield	MO	88
South Lineville	MO	28
South Van Buren	MO	824
South West City	MO	970
Southwest	MO	0
Spanish Lake	MO	19650
Sparta	MO	1792
Spickard	MO	251
Spokane	MO	177
Springfield	MO	170188
St. Ann	MO	0
St. Catharine	MO	0
St. Charles	MO	0
St. Clair	MO	0
St. Clement	MO	0
St. Cloud	MO	0
St. Elizabeth	MO	0
St. Francisville	MO	0
St. George	MO	0
St. James	MO	0
St. John	MO	0
St. Joseph	MO	0
St. Louis	MO	279695
St. Martins	MO	0
St. Mary	MO	0
St. Paul	MO	0
St. Peters	MO	0
St. Robert	MO	0
St. Thomas	MO	0
Stanberry	MO	1183
Stanton	MO	0
Stark	MO	0
Stark City	MO	140
Ste. Genevieve	MO	0
Steele	MO	2103
Steelville	MO	1699
Stella	MO	159
Stewartsville	MO	735
Stockton	MO	1859
Stotesbury	MO	18
Stotts	MO	0
Stotts City	MO	219
Stoutland	MO	192
Stoutsville	MO	45
Stover	MO	1074
Strafford	MO	2361
Strasburg	MO	142
Sturgeon	MO	907
Sugar Creek	MO	3320
Sullivan	MO	7135
Summer Set	MO	0
Summersville	MO	500
Sumner	MO	99
Sundown	MO	48
Sunrise Beach	MO	449
Sunset Hills	MO	8539
Sweet Springs	MO	1467
Sycamore Hills	MO	670
Syracuse	MO	170
Table Rock	MO	254
Tallapoosa	MO	161
Taneyville	MO	396
Taos	MO	1134
Tarkio	MO	1477
Tarrants	MO	22
Tarsney Lakes	MO	0
Tebbetts	MO	0
Terre du Lac	MO	2320
Terre Haute	MO	2320
Thayer	MO	2245
The Landing	MO	8
Theodosia	MO	258
Thomasville	MO	68
Three Creeks	MO	0
Tightwad	MO	67
Tina	MO	153
Tindall	MO	76
Tipton	MO	3377
Town and Country	MO	11106
Tracy	MO	221
Trenton	MO	5896
Trimble	MO	640
Triplett	MO	40
Troy	MO	11542
Truesdale	MO	730
Truxton	MO	94
Turney	MO	147
Tuscumbia	MO	205
Twin Oaks	MO	393
Umber View Heights	MO	48
Union	MO	10957
Union Star	MO	421
Unionville	MO	1815
Unity	MO	0
Unity Village	MO	84
University	MO	0
University City	MO	35058
Uplands Park	MO	446
Urbana	MO	407
Urich	MO	486
Utica	MO	256
Valley Park	MO	6974
Van Buren	MO	834
Vandalia	MO	4348
Vandiver	MO	72
Vanduser	MO	274
Velda	MO	0
Velda Village	MO	1420
Velda Village Hills	MO	1055
Verona	MO	604
Versailles	MO	2440
Vibbard	MO	0
Viburnum	MO	662
Vienna	MO	597
Villa Ridge	MO	2636
Village of Four Seasons	MO	0
Vinita Park	MO	1886
Vinita Terrace	MO	278
Vista	MO	53
Waco	MO	86
Wakenda	MO	90
Walker	MO	268
Walnut Grove	MO	766
Wardell	MO	402
Wardsville	MO	1546
Warrensburg	MO	19927
Warrenton	MO	8106
Warsaw	MO	2100
Warson Woods	MO	1958
Washburn	MO	435
Washington	MO	14050
Wasola	MO	113
Watson	MO	94
Waverly	MO	824
Wayland	MO	501
Waynesville	MO	5374
Weatherby	MO	106
Weatherby Lake	MO	1848
Weaubleau	MO	398
Webb	MO	0
Webb City	MO	11165
Webster Groves	MO	23177
Weingarten	MO	133
Weldon Spring	MO	5575
Weldon Spring Heights	MO	92
Wellington	MO	790
Wellston	MO	2323
Wellsville	MO	1151
Wentworth	MO	148
Wentzville	MO	35603
West Alton	MO	530
West Line	MO	100
West Plains	MO	12285
West Sullivan	MO	119
Westboro	MO	133
Weston	MO	1724
Westphalia	MO	388
Westwood	MO	279
Wheatland	MO	355
Wheaton	MO	699
Wheeling	MO	264
White Branch	MO	0
White Oak	MO	0
Whiteman AFB	MO	0
Whiteman Air Force Base	MO	2556
Whiteside	MO	78
Whitewater	MO	128
Whiting	MO	0
Wilbur Park	MO	477
Wildwood	MO	35899
Willard	MO	5454
Williamstown	MO	0
Williamsville	MO	347
Willow Springs	MO	2150
Wilson	MO	0
Wilson City	MO	117
Winchester	MO	1540
Windsor	MO	2808
Windsor Place	MO	332
Winfield	MO	1434
Winigan	MO	44
Winona	MO	1310
Winston	MO	255
Wood Heights	MO	698
Woodson Terrace	MO	4072
Wooldridge	MO	61
Worth	MO	60
Wortham	MO	275
Worthington	MO	79
Wright	MO	0
Wright City	MO	3445
Wyaconda	MO	210
Wyatt	MO	311
Zalma	MO	90
Abbeville	MS	435
Aberdeen	MS	5397
Ackerman	MS	1482
Agricola	MS	0
Alcorn State University	MS	0
Algoma	MS	602
Alligator	MS	198
Amory	MS	7067
Anguilla	MS	666
Arcola	MS	359
Arkabutla	MS	0
Arnold Line	MS	1719
Artesia	MS	431
Ashland	MS	538
Austin	MS	0
Baldwyn	MS	3339
Bassfield	MS	228
Batesville	MS	7385
Baxterville	MS	0
Bay Saint Louis	MS	9260
Bay Springs	MS	1738
Bay St. Louis	MS	0
Beaumont	MS	942
Beauregard	MS	326
Beechwood	MS	3426
Belmont	MS	2039
Belzoni	MS	2069
Benndale	MS	0
Benoit	MS	457
Benton	MS	0
Bentonia	MS	426
Bethlehem	MS	0
Beulah	MS	460
Big Creek	MS	151
Big Point	MS	611
Biggersville	MS	0
Biloxi	MS	45637
Blue Mountain	MS	953
Blue Springs	MS	233
Bobo	MS	0
Bogue Chitto	MS	887
Bolivar	MS	0
Bolton	MS	548
Bond	MS	0
Booneville	MS	8816
Bovina	MS	0
Boyle	MS	622
Brandon	MS	23529
Braxton	MS	181
Bridgetown	MS	0
Brookhaven	MS	12414
Brooksville	MS	1173
Bruce	MS	1906
Buckatunna	MS	516
Bude	MS	1012
Burnsville	MS	932
Byhalia	MS	1255
Byram	MS	11509
Caledonia	MS	1017
Calhoun	MS	0
Calhoun City	MS	1739
Canton	MS	13676
Carriere	MS	13198
Carrollton	MS	182
Carthage	MS	4899
Cary	MS	287
Centreville	MS	1560
Chalybeate	MS	0
Charleston	MS	2048
Chunky	MS	327
Clara	MS	410
Clarksdale	MS	16847
Cleary	MS	1544
Cleveland	MS	12327
Clinton	MS	25254
Cloverdale	MS	645
Coahoma	MS	356
Coffeeville	MS	872
Coldwater	MS	1608
Collins	MS	2570
Collinsville	MS	1948
Columbia	MS	6229
Columbus	MS	23168
Columbus AFB	MS	0
Columbus Air Force Base	MS	1373
Como	MS	1245
Conehatta	MS	1342
Corinth	MS	14866
Courtland	MS	509
Crawford	MS	627
Crenshaw	MS	857
Crosby	MS	297
Crowder	MS	670
Cruger	MS	361
Crystal Springs	MS	4939
D'Iberville	MS	11400
D'Lo	MS	447
Darling	MS	226
De Kalb	MS	1057
De Lisle	MS	1147
De Soto	MS	0
Decatur	MS	1797
Deemer	MS	763
DeLisle	MS	0
Delta	MS	0
Dennis	MS	0
Derma	MS	1006
Diamondhead	MS	8132
Doddsville	MS	91
Drew	MS	1775
Dublin	MS	0
Duck Hill	MS	1210
Dumas	MS	466
Duncan	MS	408
Dundee	MS	0
Durant	MS	2486
Eagle Bend	MS	0
Eastabuchie	MS	0
Ecru	MS	966
Eden	MS	100
Edwards	MS	1019
Elizabeth	MS	0
Elliott	MS	990
Ellisville	MS	4573
Enterprise	MS	503
Escatawpa	MS	3722
Ethel	MS	407
Eudora	MS	0
Eupora	MS	2106
Falcon	MS	152
Falkner	MS	509
Farmington	MS	2194
Farrell	MS	218
Fayette	MS	1577
Fernwood	MS	0
Flora	MS	1886
Florence	MS	4363
Flowood	MS	8705
Forest	MS	5695
Foxworth	MS	603
French Camp	MS	170
Friars Point	MS	1120
Fulton	MS	4077
Gattman	MS	87
Gautier	MS	18570
Georgetown	MS	283
Glen	MS	0
Glen Allan	MS	0
Glendale	MS	1657
Glendora	MS	141
Gloster	MS	909
Gluckstadt	MS	0
Golden	MS	190
Goodman	MS	1330
Grace	MS	0
Greenville	MS	32156
Greenwood	MS	15431
Grenada	MS	12900
Gulf Hills	MS	7144
Gulf Park Estates	MS	5719
Gulfport	MS	71856
Gunnison	MS	430
Guntown	MS	2608
Hamilton	MS	457
Harperville	MS	0
Hatley	MS	467
Hattiesburg	MS	46805
Hazlehurst	MS	3924
Heidelberg	MS	684
Helena	MS	1184
Henderson Point	MS	170
Hermanville	MS	692
Hernando	MS	15503
Hickory	MS	532
Hickory Flat	MS	557
Hickory Hills	MS	3107
Hide-A-Way Lake	MS	1859
Hillsboro	MS	1130
Holcomb	MS	600
Hollandale	MS	2545
Holly Springs	MS	7901
Horn Lake	MS	26915
Houlka	MS	552
Houston	MS	3544
Hurley	MS	1551
Independence	MS	0
Indianola	MS	9943
Inverness	MS	952
Isola	MS	664
Itta Bena	MS	1955
Iuka	MS	3001
Jacinto	MS	0
Jackson	MS	153701
Jonestown	MS	1214
Jumpertown	MS	487
Kearney Park	MS	1054
Kilmichael	MS	602
Kiln	MS	2238
Kirkville	MS	0
Kokomo	MS	0
Kosciusko	MS	7187
Kossuth	MS	209
Lake	MS	324
Lakeview	MS	0
Lamar	MS	0
Lambert	MS	1490
Latimer	MS	6079
Lauderdale	MS	442
Laurel	MS	18837
Leaf	MS	0
Leakesville	MS	880
Learned	MS	94
Leland	MS	4188
Lena	MS	148
Lexington	MS	1609
Liberty	MS	694
Long Beach	MS	15555
Longview	MS	0
Louin	MS	269
Louise	MS	185
Louisville	MS	6314
Lucedale	MS	3011
Lula	MS	281
Lumberton	MS	2223
Lyman	MS	1277
Lynchburg	MS	3416
Lyon	MS	330
Maben	MS	874
Macon	MS	2616
Madison	MS	25799
Magee	MS	4368
Magnolia	MS	2371
Mantachie	MS	1138
Mantee	MS	224
Marietta	MS	257
Marion	MS	1574
Marks	MS	1581
Mathiston	MS	676
Mayersville	MS	553
McComb	MS	12661
McCool	MS	131
McLain	MS	432
Meadville	MS	431
Mendenhall	MS	2488
Meridian	MS	39661
Meridian Station	MS	1090
Merigold	MS	418
Metcalfe	MS	1014
Mikoma	MS	1209
Mississippi State	MS	0
Mississippi Valley State University	MS	0
Mize	MS	331
Monticello	MS	1541
Montrose	MS	136
Mooreville	MS	650
Moorhead	MS	2261
Morgan	MS	0
Morgan City	MS	245
Morgantown	MS	1412
Morton	MS	3439
Moselle	MS	0
Moss Point	MS	13654
Mound Bayou	MS	1473
Mount Olive	MS	973
Mount Pleasant	MS	0
Myrtle	MS	502
Natchez	MS	15128
Nellieburg	MS	1414
Nettleton	MS	1953
New Albany	MS	8830
New Augusta	MS	641
New Hamilton	MS	553
New Hebron	MS	441
New Hope	MS	3193
New Houlka	MS	0
New Site	MS	0
Newton	MS	3356
Nicholson	MS	3092
Nitta Yuma	MS	0
North Carrollton	MS	455
North Tunica	MS	1035
Noxapater	MS	451
Oak Grove	MS	0
Oakland	MS	514
Ocean Springs	MS	17636
Okolona	MS	2638
Olive Branch	MS	36010
Osyka	MS	434
Ovett	MS	0
Oxford	MS	22314
Pace	MS	261
Pachuta	MS	250
Paden	MS	115
Panther Burn	MS	0
Paris	MS	0
Pascagoula	MS	22126
Pass Christian	MS	5498
Pattison	MS	0
Pearl	MS	26462
Pearl River	MS	3601
Pearlington	MS	1332
Pelahatchie	MS	1356
Petal	MS	10701
Pheba	MS	0
Philadelphia	MS	7391
Picayune	MS	10675
Pickens	MS	1075
Pittsboro	MS	199
Plantersville	MS	1163
Polkville	MS	810
Pontotoc	MS	5944
Pope	MS	209
Poplarville	MS	2985
Port Gibson	MS	1436
Porterville	MS	0
Potts Camp	MS	499
Prentiss	MS	1002
Puckett	MS	326
Purvis	MS	2335
Quitman	MS	2209
Raleigh	MS	1427
Randolph	MS	0
Rawls Springs	MS	1254
Raymond	MS	2225
Red Banks	MS	0
Redwater	MS	633
Redwood	MS	0
Rena Lara	MS	0
Renova	MS	728
Richland	MS	7087
Richton	MS	1066
Ridgeland	MS	24351
Rienzi	MS	316
Ripley	MS	5357
Robinhood	MS	0
Rolling Fork	MS	2038
Rosedale	MS	1756
Roxie	MS	473
Ruleville	MS	2790
Runnelstown	MS	0
Saint Martin	MS	7730
Sallis	MS	130
Saltillo	MS	5004
Sandersville	MS	721
Sardis	MS	1661
Satartia	MS	53
Saucier	MS	1342
Schlater	MS	298
Scooba	MS	702
Scott	MS	90
Sebastopol	MS	266
Seminary	MS	313
Senatobia	MS	7963
Shannon	MS	1771
Sharon	MS	1406
Shaw	MS	1841
Shelby	MS	2123
Sherman	MS	677
Shubuta	MS	422
Shuqualak	MS	482
Sidon	MS	509
Silver	MS	0
Silver City	MS	300
Silver Creek	MS	204
Skene	MS	0
Slate Spring	MS	117
Slate Springs	MS	0
Sledge	MS	519
Smithville	MS	913
Snow Lake Shores	MS	298
Soso	MS	403
Southaven	MS	52589
St. Martin	MS	0
Standing Pine	MS	504
Starkville	MS	25366
State Line	MS	556
Stewart	MS	0
Stoneville	MS	0
Stonewall	MS	1031
Strayhorn	MS	0
Sturgis	MS	268
Summit	MS	1682
Sumner	MS	301
Sumrall	MS	1711
Sunflower	MS	1075
Sylvarena	MS	106
Symonds	MS	0
Taylor	MS	348
Taylorsville	MS	1302
Tchula	MS	2006
Terry	MS	1103
Thaxton	MS	656
Tillatoba	MS	91
Tishomingo	MS	338
Toccopola	MS	251
Toomsuba	MS	773
Tremont	MS	466
Tucker	MS	662
Tula	MS	0
Tunica	MS	981
Tunica Resorts	MS	1910
Tupelo	MS	35680
Tutwiler	MS	3496
Tylertown	MS	1515
Union	MS	1987
University	MS	4202
Utica	MS	857
Vaiden	MS	750
Valley Park	MS	0
Van Vleet	MS	0
Vancleave	MS	5886
Vardaman	MS	1297
Verona	MS	3054
Vicksburg	MS	23131
Victoria	MS	0
Wade	MS	1074
Walls	MS	1268
Walnut	MS	764
Walnut Grove	MS	1619
Walthall	MS	139
Water Valley	MS	3380
Waterford	MS	0
Waveland	MS	6391
Waynesboro	MS	4975
Webb	MS	528
Weir	MS	445
Wesson	MS	1908
West	MS	173
West Gulfport	MS	71329
West Hattiesburg	MS	5909
West Point	MS	10990
Wheeler	MS	0
White Oak	MS	692
Wiggins	MS	4550
Winona	MS	4439
Winstonville	MS	182
Winterville	MS	0
Woodland	MS	123
Woodville	MS	995
Yazoo	MS	0
Yazoo City	MS	11245
Absarokee	MT	1150
Acton	MT	0
Agency	MT	334
Alberton	MT	424
Alder	MT	103
Alzada	MT	29
Amsterdam	MT	180
Anaconda	MT	9417
Anaconda-Deer Lodge County	MT	0
Antelope	MT	51
Argenta	MT	0
Arlee	MT	636
Ashland	MT	824
Augusta	MT	309
Avon	MT	111
Ayers Ranch Colony	MT	0
Azure	MT	286
Babb	MT	174
Bainville	MT	318
Baker	MT	2011
Ballantine	MT	320
Basin	MT	212
Batavia	MT	385
Bear Dance	MT	275
Bearcreek	MT	83
Beaver Creek	MT	271
Belfry	MT	218
Belgrade	MT	8029
Belknap	MT	158
Belt	MT	596
Biddle	MT	41
Big Arm	MT	177
Big Sandy	MT	593
Big Sky	MT	2308
Big Sky Colony	MT	0
Big Stone Colony	MT	0
Big Timber	MT	1648
Bigfork	MT	4270
Billings	MT	117116
Birch Creek Colony	MT	120
Birney	MT	137
Birney Day School	MT	137
Black Eagle	MT	904
Blackfoot	MT	0
Bloomfield	MT	0
Boneau	MT	380
Bonner-West Riverside	MT	1663
Boulder	MT	1207
Box Elder	MT	87
Boyd	MT	35
Bozeman	MT	43405
Brady	MT	140
Brandon	MT	0
Bridger	MT	729
Broadus	MT	488
Broadview	MT	196
Brockton	MT	246
Brockway	MT	0
Brooks	MT	0
Browning	MT	1027
Bull Lake	MT	0
Busby	MT	745
Butte	MT	34190
Butte-Silver Bow	MT	0
Bynum	MT	31
Camas	MT	58
Camp Three	MT	173
Camrose Colony	MT	0
Canyon Creek	MT	0
Cardwell	MT	50
Carlton	MT	694
Carter	MT	58
Cascade	MT	696
Cascade Colony	MT	0
Centerville	MT	0
Charlo	MT	379
Charlos Heights	MT	120
Chester	MT	883
Chinook	MT	1228
Choteau	MT	1696
Churchill	MT	902
Circle	MT	613
Clancy	MT	1661
Clinton	MT	1052
Clyde Park	MT	309
Coffee Creek	MT	0
Colstrip	MT	2336
Columbia Falls	MT	5093
Columbus	MT	2042
Condon	MT	343
Conner	MT	216
Conrad	MT	2593
Cooke	MT	0
Cooke City	MT	75
Coram	MT	539
Corvallis	MT	976
Corwin Springs	MT	109
Craig	MT	43
Crane	MT	102
Crow Agency	MT	1616
Culbertson	MT	815
Custer	MT	159
Cut Bank	MT	3002
Cyr	MT	63
Danvers	MT	0
Darby	MT	747
Dayton	MT	84
De Borgia	MT	78
Deer Lodge	MT	2965
Deerfield Colony	MT	0
Dell	MT	0
Denton	MT	248
Dewey	MT	0
Dillon	MT	4210
Dixon	MT	203
Dodson	MT	124
Drummond	MT	336
Duncan Ranch Colony	MT	0
Dupuyer	MT	86
Dutton	MT	316
Eagle Creek Colony	MT	0
East End Colony	MT	0
East Glacier Park	MT	0
East Glacier Park Village	MT	363
East Helena	MT	2057
East Malta Colony	MT	0
East Missoula	MT	2157
Edgar	MT	114
Ekalaka	MT	345
Elkhorn	MT	10
Elliston	MT	219
Elmo	MT	180
Emigrant	MT	488
Ennis	MT	884
Essex	MT	0
Eureka	MT	1074
Evaro	MT	322
Evergreen	MT	7616
Fair Haven Colony	MT	0
Fairfield	MT	733
Fairview	MT	962
Fallon	MT	164
Finley Point	MT	480
Fishtail	MT	0
Flat Willow Colony	MT	0
Flaxville	MT	71
Florence	MT	765
Floweree	MT	0
Fords Creek Colony	MT	0
Forest Hill	MT	0
Forest Hill Village	MT	206
Forsyth	MT	1892
Fort Belknap Agency	MT	1293
Fort Benton	MT	1460
Fort Peck	MT	251
Fort Shaw	MT	280
Fort Smith	MT	161
Fortine	MT	325
Forty Mile Colony	MT	0
Four Corners	MT	3146
Fox	MT	0
Fox Lake	MT	158
Frazer	MT	362
Frenchtown	MT	1825
Froid	MT	205
Fromberg	MT	444
Gallatin Gateway	MT	856
Gallatin River Ranch	MT	0
Gardiner	MT	875
Garrison	MT	96
Geraldine	MT	263
Geyser	MT	87
Gibson Flats	MT	199
Gildford	MT	179
Gildford Colony	MT	0
Gilman	MT	0
Glacier Colony	MT	0
Glasgow	MT	3414
Glen	MT	0
Glendale Colony	MT	0
Glendive	MT	5490
Goldcreek	MT	0
Golden Valley Colony	MT	0
Grant	MT	0
Grass Range	MT	110
Great Falls	MT	59638
Greycliff	MT	112
Hall	MT	0
Hamilton	MT	4602
Happys Inn	MT	164
Hardin	MT	3800
Hardy	MT	0
Harlem	MT	822
Harlowton	MT	979
Harrison	MT	137
Hartland Colony	MT	0
Haugan	MT	0
Havre	MT	9834
Havre North	MT	716
Hays	MT	843
Heart Butte	MT	582
Hebgen Lake Estates	MT	70
Helena	MT	32091
Helena Flats	MT	0
Helena Valley Northeast	MT	2995
Helena Valley Northwest	MT	3482
Helena Valley Southeast	MT	8227
Helena Valley West Central	MT	7883
Helena West Side	MT	1637
Helmville	MT	0
Heron	MT	282
Herron	MT	116
Hidden Lake Colony	MT	0
Highwood	MT	176
Hilger	MT	0
Hilldale Colony	MT	0
Hillside Colony	MT	0
Hingham	MT	123
Hinsdale	MT	217
Hobson	MT	216
Hogeland	MT	0
Homestead	MT	0
Horizon Colony	MT	0
Hot Springs	MT	547
Hungry Horse	MT	826
Huntley	MT	446
Huson	MT	210
Hysham	MT	304
Indian Springs	MT	31
Inverness	MT	55
Ismay	MT	21
Jackson	MT	0
Jardine	MT	57
Jeffers	MT	0
Jefferson	MT	0
Jefferson City	MT	472
Jette	MT	253
Joliet	MT	638
Joplin	MT	157
Jordan	MT	399
Judith Gap	MT	125
Kalispell	MT	22052
Kerr	MT	251
Kevin	MT	143
Kicking Horse	MT	286
Kila	MT	392
Kilby Butte Colony	MT	0
King Arthur Park	MT	738
King Ranch Colony	MT	0
Kings Point	MT	151
Kingsbury Colony	MT	0
Klein	MT	168
Knife River	MT	320
Kremlin	MT	98
Lake Mary Ronan	MT	65
Lakeside	MT	2669
Lakeview	MT	0
Lame Deer	MT	2052
Landusky	MT	0
Laredo	MT	0
Laurel	MT	6943
Lavina	MT	171
Lewistown	MT	5874
Lewistown Heights	MT	407
Libby	MT	2645
Lima	MT	222
Lincoln	MT	1013
Lindisfarne	MT	284
Lindsay	MT	0
Little Bitterroot Lake	MT	0
Little Browning	MT	206
Livingston	MT	7302
Lockwood	MT	6797
Lodge Grass	MT	445
Lodge Pole	MT	265
Logan	MT	99
Lolo	MT	3892
Loma	MT	85
Lonepine	MT	162
Loring Colony	MT	0
Luther	MT	0
Malmstrom AFB	MT	0
Malmstrom Air Force Base	MT	3472
Malta	MT	1963
Mammoth	MT	0
Manhattan	MT	1631
Marion	MT	886
Martin	MT	0
Martin City	MT	500
Martinsdale	MT	64
Martinsdale Colony	MT	0
Marysville	MT	80
Maverick Mountain	MT	0
Maxville	MT	130
McAllister	MT	0
Medicine Lake	MT	244
Melstone	MT	106
Midvale	MT	393
Midway Colony	MT	0
Miles	MT	0
Miles City	MT	8796
Milford Colony	MT	0
Miller Colony	MT	0
Missoula	MT	71022
Moccasin	MT	0
Monarch	MT	0
Montana	MT	0
Montana City	MT	2715
Montaqua	MT	0
Moore	MT	200
Mountain View Colony	MT	0
Muddy	MT	617
Musselshell	MT	60
Nashua	MT	296
Neihart	MT	51
New Miami Colony	MT	0
New Rockport Colony	MT	0
Niarada	MT	27
Nibbe	MT	0
Norris	MT	0
North Browning	MT	2408
North Harlem Colony	MT	0
Noxon	MT	218
Nye	MT	0
Old Agency	MT	107
Olney	MT	191
Opheim	MT	89
Orchard Homes	MT	5197
Outlook	MT	53
Ovando	MT	81
Pablo	MT	2254
Paradise	MT	163
Park	MT	0
Park City	MT	983
Parker School	MT	340
Peerless	MT	0
Pendroy	MT	0
Philipsburg	MT	884
Piltzville	MT	395
Pine Creek	MT	0
Pinesdale	MT	954
Pinnacle	MT	0
Pioneer Junction	MT	959
Plains	MT	1051
Pleasant Valley Colony	MT	0
Plentywood	MT	1923
Plevna	MT	183
Polebridge	MT	0
Polson	MT	4707
Pompeys Pillar	MT	0
Pondera Colony	MT	0
Ponderosa Pines	MT	336
Pony	MT	118
Poplar	MT	871
Potomac	MT	0
Power	MT	179
Prairie Elk Colony	MT	0
Pray	MT	681
Pryor	MT	618
Racetrack	MT	0
Rader Creek	MT	0
Radersburg	MT	66
Rapelje	MT	0
Ravalli	MT	76
Raynesford	MT	0
Red Lodge	MT	2222
Redstone	MT	0
Reed Point	MT	193
Reserve	MT	23
Rexford	MT	147
Rhodes	MT	0
Riceville	MT	0
Richey	MT	177
Rimini	MT	0
Rimrock Colony	MT	0
Riverbend	MT	484
Riverview Colony	MT	0
Roberts	MT	361
Rockport Colony	MT	0
Rockvale	MT	0
Rocky Boy West	MT	0
Rocky Boy's Agency	MT	355
Rocky Point	MT	97
Rollins	MT	209
Ronan	MT	1981
Roscoe	MT	15
Rosebud	MT	111
Roundup	MT	1836
Roy	MT	108
Rudyard	MT	258
Ryegate	MT	236
Saco	MT	201
Saddle Butte	MT	128
Sage Creek Colony	MT	0
Saint Ignatius	MT	842
Saint Marie	MT	264
Saint Pierre	MT	350
Saint Regis	MT	319
Saint Xavier	MT	83
Saltese	MT	0
Sand Coulee	MT	212
Sangrey	MT	306
Santa Rita	MT	113
Sapphire Ridge	MT	0
Savage	MT	0
Scobey	MT	1033
Sedan	MT	99
Seeley Lake	MT	1659
Seville Colony	MT	0
Shawmut	MT	42
Shelby	MT	3268
Shepherd	MT	516
Sheridan	MT	677
Sidney	MT	6828
Silesia	MT	96
Silver Gate	MT	20
Silver Star	MT	0
Simms	MT	354
Sleeping Buffalo	MT	0
Snowslip	MT	0
Somers	MT	1109
South Browning	MT	1785
South Glastonbury	MT	284
South Hills	MT	517
Spokane Creek	MT	0
Spring Creek Colony	MT	0
Springdale	MT	42
Springdale Colony	MT	0
Springhill	MT	130
Springwater Colony	MT	0
Square Butte	MT	0
St. Ignatius	MT	0
St. Marie	MT	0
St. Mary	MT	0
St. Pierre	MT	0
St. Regis	MT	0
St. Xavier	MT	0
Stanford	MT	381
Starr School	MT	252
Stevensville	MT	1922
Stockett	MT	169
Stryker	MT	26
Sula	MT	37
Sun Prairie	MT	1630
Sun River	MT	124
Sunburst	MT	351
Sunnybrook Colony	MT	0
Superior	MT	839
Surprise Creek Colony	MT	0
Swan Lake	MT	113
Sweet Grass	MT	58
Sylvanite	MT	103
Terry	MT	597
The Silos	MT	506
Thompson Falls	MT	1332
Three Forks	MT	1926
Toston	MT	108
Townsend	MT	1959
Tracy	MT	0
Trego	MT	541
Trout Creek	MT	242
Troy	MT	877
Turah	MT	306
Turner	MT	61
Turner Colony	MT	0
Turtle Lake	MT	209
Twin Bridges	MT	394
Twin Creeks	MT	0
Twin Hills Colony	MT	0
Twodot	MT	0
Ulm	MT	738
Unionville	MT	0
Utica	MT	0
Valier	MT	508
Vaughn	MT	658
Victor	MT	745
Vida	MT	0
Virginia	MT	0
Virginia City	MT	199
Walkerville	MT	700
Warm Spring Creek	MT	0
Warm Springs	MT	3000
Weeksville	MT	83
West Glacier	MT	227
West Glendive	MT	1948
West Havre	MT	316
West Kootenai	MT	365
West Yellowstone	MT	1339
Westby	MT	176
Wheatland	MT	0
White Haven	MT	577
White Sulphur Springs	MT	910
Whitefish	MT	7073
Whitehall	MT	1094
Whitetail	MT	0
Whitewater	MT	64
Whitlash	MT	0
Wibaux	MT	666
Willow Creek	MT	210
Wilsall	MT	178
Windham	MT	0
Wineglass	MT	0
Winifred	MT	205
Winnett	MT	179
Winston	MT	147
Wisdom	MT	98
Wise River	MT	0
Wolf Creek	MT	0
Wolf Point	MT	2850
Woods Bay	MT	661
Worden	MT	577
Wye	MT	511
Wyola	MT	215
Yaak	MT	248
York	MT	0
Zenith Colony	MT	0
Zortman	MT	69
Zurich	MT	0
Aberdeen	NC	7343
Advance	NC	1138
Ahoskie	NC	4910
Alamance	NC	991
Albemarle	NC	16003
Alexander Mills	NC	661
Alexis	NC	0
Alliance	NC	749
Altamahaw	NC	347
Anderson Creek	NC	0
Andrews	NC	1752
Angier	NC	4970
Ansonville	NC	595
Apex	NC	45585
Aquadale	NC	397
Arapahoe	NC	538
Archdale	NC	11564
Archer Lodge	NC	4708
Arlington	NC	781
Arrowhead Beach	NC	0
Asheboro	NC	26103
Asheville	NC	95056
Ashley Heights	NC	380
Askewville	NC	229
Atkinson	NC	329
Atlantic	NC	543
Atlantic Beach	NC	1502
Aulander	NC	834
Aurora	NC	522
Autryville	NC	202
Avery Creek	NC	1950
Avon	NC	776
Ayden	NC	5053
Badin	NC	1981
Bailey	NC	565
Bakersville	NC	452
Bald Head Island	NC	171
Balfour	NC	1187
Banner Elk	NC	1138
Barbecue	NC	0
Barker Heights	NC	1254
Barker Ten Mile	NC	952
Barnardsville	NC	0
Bath	NC	250
Battleboro	NC	527
Bayboro	NC	1243
Bayshore	NC	3393
Bayview	NC	346
Bear Grass	NC	71
Beaufort	NC	4212
Beech Mountain	NC	320
Belhaven	NC	1602
Bell Arthur	NC	466
Belmont	NC	10533
Belville	NC	1936
Belvoir	NC	307
Belwood	NC	929
Bennett	NC	282
Benson	NC	3591
Bent Creek	NC	1287
Bermuda Run	NC	2561
Bessemer	NC	0
Bessemer City	NC	5548
Bethania	NC	346
Bethel	NC	1620
Bethlehem	NC	4214
Beulaville	NC	1330
Biltmore Forest	NC	1441
Biscoe	NC	1690
Black Creek	NC	767
Black Mountain	NC	8278
Bladenboro	NC	1726
Blowing Rock	NC	1292
Blue Clay Farms	NC	33
Boardman	NC	155
Boger City	NC	593
Bogue	NC	701
Boiling Spring Lakes	NC	5789
Boiling Springs	NC	4674
Bolivia	NC	151
Bolton	NC	673
Bonnetsville	NC	443
Boone	NC	18156
Boonville	NC	1207
Bostic	NC	378
Bowdens	NC	0
Bowmore	NC	103
Brandywine Bay	NC	0
Brevard	NC	7735
Briar Chapel	NC	5108
Brices Creek	NC	3073
Bridgeton	NC	440
Broad Creek	NC	2334
Broadway	NC	1264
Brogden	NC	2633
Brookford	NC	375
Brunswick	NC	1131
Bryson	NC	0
Bryson City	NC	1458
Buies Creek	NC	2942
Bunn	NC	362
Bunnlevel	NC	552
Burgaw	NC	4100
Burlington	NC	52472
Burnsville	NC	1660
Butner	NC	7751
Butters	NC	294
Buxton	NC	1273
Cajah's Mountain	NC	0
Cajahs Mountain	NC	2823
Calabash	NC	2119
Calypso	NC	548
Camden	NC	599
Cameron	NC	295
Candor	NC	838
Canton	NC	4190
Cape Carteret	NC	2066
Cape Colony	NC	0
Caroleen	NC	652
Carolina Beach	NC	6137
Carolina Meadows	NC	0
Carolina Shores	NC	3767
Carrboro	NC	21156
Carthage	NC	2395
Cary	NC	159769
Casar	NC	294
Cashiers	NC	157
Castalia	NC	262
Castle Hayne	NC	1202
Caswell Beach	NC	422
Catawba	NC	618
Cedar Point	NC	1304
Cedar Rock	NC	294
Centerville	NC	92
Cerro Gordo	NC	200
Chadbourn	NC	1791
Chapel Hill	NC	59568
Charlotte	NC	911311
Cherokee	NC	2138
Cherry Branch	NC	0
Cherryville	NC	5974
Chimney Rock	NC	113
China Grove	NC	4182
Chinquapin	NC	0
Chocowinity	NC	821
Chowan Beach	NC	0
Claremont	NC	1365
Clarkton	NC	820
Clayton	NC	19304
Clemmons	NC	19844
Cleveland	NC	873
Cliffside	NC	611
Clinton	NC	8767
Clyde	NC	1243
Coats	NC	2408
Cofield	NC	395
Coinjock	NC	335
Colerain	NC	191
Columbia	NC	832
Columbus	NC	994
Como	NC	89
Concord	NC	87696
Conetoe	NC	281
Connelly Springs	NC	1635
Conover	NC	8248
Conway	NC	772
Cooleemee	NC	972
Cordova	NC	1775
Cornelius	NC	28092
Cove	NC	0
Cove City	NC	396
Cove Creek	NC	1171
Cramerton	NC	4328
Creedmoor	NC	4425
Creswell	NC	261
Cricket	NC	1855
Crossnore	NC	192
Crouse	NC	0
Cullowhee	NC	6228
Cypress Landing	NC	0
Dallas	NC	4622
Dana	NC	3329
Danbury	NC	187
Davidson	NC	12207
Davis	NC	422
Deep Run	NC	0
Deercroft	NC	0
Delco	NC	348
Dellview	NC	13
Delway	NC	203
Denton	NC	1657
Denver	NC	2309
Dillsboro	NC	240
Dobbins Heights	NC	838
Dobson	NC	1573
Dortches	NC	930
Dover	NC	430
Drexel	NC	1866
Dublin	NC	333
Duck	NC	383
Dudley	NC	0
Dundarrach	NC	41
Dunn	NC	9723
Durham	NC	257636
Earl	NC	257
East Arcadia	NC	477
East Bend	NC	600
East Flat Rock	NC	4995
East Laurinburg	NC	300
East Rockingham	NC	3736
East Spencer	NC	1549
Eastover	NC	3677
Eden	NC	15403
Edenton	NC	4849
Edneyville	NC	2367
Efland	NC	734
Elizabeth	NC	0
Elizabeth City	NC	17988
Elizabethtown	NC	3586
Elk Park	NC	442
Elkin	NC	4060
Ellenboro	NC	854
Ellerbe	NC	1005
Elm	NC	0
Elm City	NC	1350
Elon	NC	10024
Elrod	NC	417
Elroy	NC	3869
Emerald Isle	NC	3720
Emma	NC	0
Enfield	NC	2427
Engelhard	NC	445
Enochville	NC	2925
Erwin	NC	4679
Etowah	NC	6944
Eureka	NC	199
Everetts	NC	159
Evergreen	NC	420
Fair Bluff	NC	917
Fairfield	NC	258
Fairfield Harbour	NC	2952
Fairmont	NC	2697
Fairplains	NC	2120
Fairview	NC	3684
Faison	NC	985
Faith	NC	811
Falcon	NC	269
Falkland	NC	98
Fallston	NC	601
Farmington	NC	0
Farmville	NC	4758
Fayetteville	NC	201963
Fearrington	NC	869
Fearrington Village	NC	2339
Five Points	NC	689
Flat Rock	NC	3313
Fletcher	NC	7582
Fontana Dam	NC	0
Forest	NC	0
Forest City	NC	7282
Forest Hills	NC	372
Forest Oaks	NC	3890
Fort Bragg	NC	29183
Foscoe	NC	1370
Fountain	NC	435
Four Oaks	NC	2050
Foxfire	NC	972
Franklin	NC	3940
Franklinton	NC	2135
Franklinville	NC	1157
Fremont	NC	1280
Frisco	NC	200
Fruitland	NC	2031
Fuquay-Varina	NC	23907
Gamewell	NC	3957
Garland	NC	632
Garner	NC	28053
Garysburg	NC	977
Gaston	NC	1067
Gastonia	NC	74543
Gatesville	NC	302
Germanton	NC	827
Gerton	NC	254
Gibson	NC	519
Gibsonville	NC	6773
Glen Alpine	NC	1500
Glen Raven	NC	2750
Glenville	NC	110
Glenwood	NC	0
Gloucester	NC	537
Godwin	NC	145
Gold Hill	NC	0
Goldsboro	NC	35826
Goldston	NC	301
Gorman	NC	1011
Governors	NC	0
Governors Club	NC	0
Graham	NC	14647
Graingers	NC	0
Grandfather	NC	25
Grandy	NC	0
Granite Falls	NC	4662
Granite Quarry	NC	2995
Grantsboro	NC	662
Green Level	NC	2160
Greenevers	NC	651
Greensboro	NC	285342
Greenville	NC	90597
Grifton	NC	2673
Grimesland	NC	444
Grover	NC	701
Gulf	NC	144
Half Moon	NC	8352
Halifax	NC	225
Hallsboro	NC	465
Hamilton	NC	384
Hamlet	NC	6454
Hampstead	NC	4083
Harkers Island	NC	1207
Harmony	NC	563
Harrells	NC	205
Harrellsville	NC	105
Harrisburg	NC	14539
Hassell	NC	81
Hatteras	NC	504
Havelock	NC	20364
Haw River	NC	2402
Hayesville	NC	364
Hays	NC	1851
Hazelwood	NC	1655
Hemby Bridge	NC	1676
Henderson	NC	15271
Hendersonville	NC	13814
Henrietta	NC	461
Hertford	NC	2148
Hickory	NC	40374
Hiddenite	NC	536
High Point	NC	110268
High Shoals	NC	722
Highlands	NC	937
Hightsville	NC	739
Hildebran	NC	2000
Hillsborough	NC	6415
Hillsdale	NC	984
Hobgood	NC	335
Hobucken	NC	129
Hoffman	NC	572
Holden Beach	NC	631
Hollister	NC	674
Holly Ridge	NC	2096
Holly Springs	NC	31377
Hookerton	NC	401
Hoopers Creek	NC	1056
Hope Mills	NC	16163
Horse Shoe	NC	2351
Hot Springs	NC	562
Hudson	NC	3721
Huntersville	NC	52704
Icard	NC	2664
Indian Beach	NC	115
Indian Trail	NC	37073
Ingold	NC	471
Iron Station	NC	755
Ivanhoe	NC	264
Jaars	NC	597
Jackson	NC	481
Jackson Heights	NC	0
Jackson Springs	NC	0
Jacksonville	NC	67357
James	NC	0
James City	NC	5899
Jamestown	NC	3737
Jamesville	NC	468
Jefferson	NC	1606
Jonesville	NC	2257
Kannapolis	NC	46144
Keener	NC	567
Kelford	NC	236
Kelly	NC	544
Kenansville	NC	870
Kenly	NC	1450
Kernersville	NC	23811
Kill Devil Hills	NC	7058
King	NC	7059
Kings Grant	NC	8278
Kings Mountain	NC	10760
Kingstown	NC	674
Kinston	NC	21337
Kirkland	NC	619
Kittrell	NC	473
Kitty Hawk	NC	3447
Knightdale	NC	14256
Kure Beach	NC	2091
La Grange	NC	2804
Lake Junaluska	NC	2734
Lake Lure	NC	1184
Lake Norman of Catawba	NC	5075
Lake Norman of Iredell	NC	0
Lake Park	NC	3789
Lake Royale	NC	0
Lake Santeetlah	NC	44
Lake Waccamaw	NC	1465
Landis	NC	3116
Lansing	NC	155
Lasker	NC	114
Lattimore	NC	484
Laurel Hill	NC	1254
Laurel Park	NC	2314
Laurinburg	NC	15507
Lawndale	NC	592
Leggett	NC	58
Leland	NC	17924
Lenoir	NC	17888
Lewiston Woodville	NC	508
Lewisville	NC	13567
Lexington	NC	19326
Liberty	NC	2683
Light Oak	NC	691
Lilesville	NC	505
Lillington	NC	3476
Lincolnton	NC	10900
Linden	NC	134
Linville	NC	0
Littleton	NC	646
Locust	NC	2966
Long Beach	NC	5618
Long Creek	NC	0
Long View	NC	0
Longview	NC	4871
Louisburg	NC	3553
Love Valley	NC	100
Lowell	NC	3649
Lowesville	NC	2945
Lowgap	NC	324
Lucama	NC	1132
Lumber Bridge	NC	93
Lumberton	NC	21667
Macclesfield	NC	451
Macon	NC	116
Madison	NC	2197
Maggie Valley	NC	1251
Magnolia	NC	949
Maiden	NC	3369
Mamers	NC	826
Manns Harbor	NC	821
Manteo	NC	1388
Mar-Mac	NC	3615
Marble	NC	321
Marietta	NC	177
Marion	NC	7861
Mars Hill	NC	2256
Marshall	NC	876
Marshallberg	NC	403
Marshville	NC	2638
Marvin	NC	6181
Masonboro	NC	14826
Matthews	NC	30678
Maury	NC	1685
Maxton	NC	2451
Mayodan	NC	2470
Maysville	NC	1004
McAdenville	NC	674
McDonald	NC	114
McFarlan	NC	111
McLeansville	NC	1021
Mebane	NC	13698
Mesic	NC	213
Micro	NC	484
Middleburg	NC	132
Middlesex	NC	814
Midland	NC	3379
Midway	NC	4742
Millers Creek	NC	2112
Millingport	NC	599
Mills River	NC	7162
Milton	NC	161
Milwaukee	NC	157
Mineral Springs	NC	2908
Minnesott Beach	NC	430
Mint Hill	NC	25627
Misenheimer	NC	717
Mocksville	NC	5151
Momeyer	NC	219
Moncure	NC	711
Monroe	NC	34623
Montreat	NC	723
Mooresboro	NC	308
Mooresville	NC	36009
Moravian Falls	NC	1901
Morehead	NC	0
Morehead City	NC	9347
Morganton	NC	16692
Morrisville	NC	23820
Morven	NC	471
Mount Airy	NC	10354
Mount Gilead	NC	1180
Mount Holly	NC	14176
Mount Olive	NC	4728
Mount Pleasant	NC	1821
Mountain Home	NC	3622
Mountain View	NC	3552
Moyock	NC	3759
Mulberry	NC	2332
Murfreesboro	NC	3002
Murphy	NC	1615
Murraysville	NC	14215
Myrtle Grove	NC	8875
Nags Head	NC	2908
Nashville	NC	5460
Navassa	NC	1636
Nebo	NC	0
Neuse Forest	NC	2005
New Bern	NC	30070
New Hope	NC	0
New London	NC	604
Newland	NC	686
Newport	NC	4723
Newton	NC	13035
Newton Grove	NC	576
Norlina	NC	1081
Norman	NC	132
North Topsail Beach	NC	738
North Wilkesboro	NC	4226
Northchase	NC	3747
Northlakes	NC	1534
Northwest	NC	769
Norwood	NC	2394
Oak	NC	0
Oak City	NC	300
Oak Island	NC	7507
Oak Ridge	NC	6671
Oakboro	NC	1874
Ocean Isle Beach	NC	597
Ocracoke	NC	948
Ogden	NC	6766
Old Fort	NC	911
Old Hundred	NC	287
Oriental	NC	885
Orrum	NC	92
Ossipee	NC	562
Oxford	NC	8742
Pantego	NC	177
Parkton	NC	439
Parmele	NC	264
Patterson Springs	NC	604
Peachland	NC	414
Peletier	NC	651
Pembroke	NC	3004
Pikeville	NC	692
Pilot Mountain	NC	1465
Pine Knoll Shores	NC	1364
Pine Level	NC	1861
Pinebluff	NC	1439
Pinehurst	NC	15752
Pinetops	NC	1319
Pinetown	NC	155
Pineville	NC	8429
Piney Green	NC	13293
Pink Hill	NC	540
Pinnacle	NC	894
Pittsboro	NC	4198
Plain View	NC	1961
Pleasant Garden	NC	4715
Pleasant Hill	NC	1087
Plymouth	NC	3658
Polkton	NC	3495
Polkville	NC	536
Pollocksville	NC	308
Pope Air Force Base (historical)	NC	7680
Porters Neck	NC	0
Potters Hill	NC	481
Powellsville	NC	259
Princeton	NC	1284
Princeville	NC	1991
Proctorville	NC	118
Prospect	NC	981
Pumpkin Center	NC	2222
Raeford	NC	4860
Raemon	NC	282
Raleigh	NC	482295
Ramseur	NC	1701
Randleman	NC	4153
Ranlo	NC	3556
Raynham	NC	73
Red Cross	NC	742
Red Oak	NC	3424
Red Springs	NC	3433
Reidsville	NC	14067
Rennert	NC	379
Rex	NC	55
Rhodhiss	NC	1048
Rich Square	NC	901
Richfield	NC	611
Richlands	NC	1689
Riegelwood	NC	579
River Bend	NC	3149
River Road	NC	4394
Roanoke Rapids	NC	15345
Robbins	NC	1184
Robbinsville	NC	598
Roberdel	NC	0
Robersonville	NC	1424
Rockfish	NC	3298
Rockingham	NC	9220
Rockwell	NC	2144
Rocky Mount	NC	55806
Rocky Point	NC	1602
Rodanthe	NC	261
Rolesville	NC	6289
Ronda	NC	413
Roper	NC	570
Rose Hill	NC	1665
Roseboro	NC	1203
Rosman	NC	573
Rougemont	NC	978
Rowland	NC	1050
Roxboro	NC	8334
Roxobel	NC	225
Royal Pines	NC	4272
Ruffin	NC	368
Rural Hall	NC	3126
Ruth	NC	428
Rutherford College	NC	1341
Rutherfordton	NC	4182
Saint Helena	NC	389
Saint James	NC	3165
Saint Pauls	NC	2035
Saint Stephens	NC	8759
Salem	NC	2218
Salemburg	NC	435
Salisbury	NC	34017
Saluda	NC	707
Salvo	NC	229
Sandy Creek	NC	267
Sandyfield	NC	424
Sanford	NC	29144
Saratoga	NC	408
Sawmills	NC	5104
Saxapahaw	NC	1648
Scotch Meadows	NC	0
Scotland Neck	NC	1965
Scotts Mill	NC	2400
Sea Breeze	NC	1969
Seaboard	NC	587
Seagate	NC	4590
Seagrove	NC	229
Sedalia	NC	660
Selma	NC	6307
Seven Devils	NC	192
Seven Lakes	NC	4888
Seven Springs	NC	111
Severn	NC	258
Shallotte	NC	3991
Shannon	NC	263
Sharpsburg	NC	2003
Shelby	NC	20189
Sherrills Ford	NC	1007
Siler	NC	0
Siler City	NC	8396
Silver	NC	0
Silver City	NC	882
Silver Lake	NC	5598
Simpson	NC	426
Sims	NC	282
Skippers Corner	NC	2785
Smithfield	NC	12022
Smithtown	NC	0
Sneads Ferry	NC	2646
Snow Hill	NC	1574
South Gastonia	NC	5312
South Henderson	NC	1213
South Mills	NC	454
South Rosemary	NC	2836
South Weldon	NC	705
Southern Pines	NC	13539
Southern Shores	NC	2867
Southmont	NC	1470
Southport	NC	3475
Sparta	NC	1726
Speed	NC	78
Spencer	NC	3291
Spencer Mountain	NC	38
Spindale	NC	4263
Spivey's Corner	NC	0
Spiveys Corner	NC	506
Spout Springs	NC	0
Spring Hope	NC	1313
Spring Lake	NC	13234
Springdale	NC	0
Spruce Pine	NC	2134
St. Helena	NC	0
St. James	NC	0
St. Pauls	NC	0
St. Stephens	NC	0
Staley	NC	395
Stallings	NC	15270
Stanfield	NC	1490
Stanley	NC	3685
Stantonsburg	NC	788
Star	NC	874
Statesville	NC	26221
Stedman	NC	1045
Stem	NC	471
Stokes	NC	376
Stokesdale	NC	5340
Stoneville	NC	1038
Stonewall	NC	270
Stony Point	NC	1317
Stovall	NC	430
Sugar Mountain	NC	197
Summerfield	NC	10861
Sunbury	NC	289
Sunset Beach	NC	3801
Surf	NC	0
Surf City	NC	2193
Swan Quarter	NC	0
Swannanoa	NC	4576
Swanquarter	NC	324
Swansboro	NC	3149
Swepsonville	NC	1204
Sylva	NC	2617
Tabor	NC	0
Tabor City	NC	3927
Tar Heel	NC	146
Tarboro	NC	11164
Taylorsville	NC	2078
Taylortown	NC	816
Teachey	NC	436
Thomasville	NC	27061
Thurmond	NC	1611
Toast	NC	1450
Tobaccoville	NC	2584
Topsail Beach	NC	414
Trent Woods	NC	4189
Trenton	NC	287
Trinity	NC	6669
Troutman	NC	2544
Troy	NC	3427
Tryon	NC	1721
Turkey	NC	296
Tyro	NC	3879
Unionville	NC	6547
Valdese	NC	4459
Valle Crucis	NC	412
Valley Hill	NC	2070
Vanceboro	NC	1000
Vandemere	NC	244
Vander	NC	1146
Vann Crossroads	NC	336
Varnamtown	NC	572
Vass	NC	749
Waco	NC	318
Wade	NC	560
Wadesboro	NC	5584
Wagram	NC	807
Wake Forest	NC	38199
Wakulla	NC	105
Walkertown	NC	4969
Wallace	NC	3964
Wallburg	NC	3078
Walnut Cove	NC	1402
Walnut Creek	NC	861
Walstonburg	NC	218
Wanchese	NC	1642
Warrenton	NC	866
Warsaw	NC	3175
Washington	NC	9788
Washington Park	NC	450
Watha	NC	226
Waves	NC	134
Waxhaw	NC	13495
Waynesville	NC	9809
Weaverville	NC	3936
Webster	NC	375
Weddington	NC	10531
Welcome	NC	4162
Weldon	NC	1586
Wendell	NC	6285
Wentworth	NC	2765
Wesley Chapel	NC	8355
West Canton	NC	1247
West Jefferson	NC	1308
West Marion	NC	1348
West Raleigh	NC	338759
West Smithfield	NC	63
Westport	NC	4026
Whispering Pines	NC	3148
Whitakers	NC	725
White Lake	NC	782
White Oak	NC	338
White Plains	NC	1074
Whiteville	NC	5589
Whitsett	NC	623
Whittier	NC	0
Wilkesboro	NC	3531
Williamston	NC	5508
Wilmington	NC	115933
Wilson	NC	49643
Wilson's Mills	NC	0
Wilsons Mills	NC	2277
Windsor	NC	3785
Winfall	NC	600
Wingate	NC	3854
Winston-Salem	NC	241218
Winterville	NC	9464
Winton	NC	745
Woodfin	NC	6349
Woodland	NC	744
Woodlawn	NC	900
Wrightsboro	NC	4896
Wrightsville Beach	NC	2564
Yadkin College	NC	0
Yadkinville	NC	2927
Yanceyville	NC	2004
Yaupon Beach	NC	922
Youngsville	NC	1217
Zebulon	NC	4964
Abercrombie	ND	259
Adams	ND	124
Alamo	ND	50
Alexander	ND	252
Alice	ND	40
Almont	ND	112
Alsen	ND	33
Ambrose	ND	27
Amenia	ND	93
Amidon	ND	21
Anamoose	ND	249
Aneta	ND	209
Antler	ND	28
Apple Valley	ND	0
Ardoch	ND	66
Argusville	ND	475
Arnegard	ND	126
Arthur	ND	362
Arvilla	ND	333
Ashley	ND	726
Auburn	ND	48
Ayr	ND	17
Baldwin	ND	545
Balfour	ND	27
Balta	ND	64
Bantry	ND	15
Barney	ND	51
Barton	ND	20
Bathgate	ND	41
Beach	ND	1115
Belcourt	ND	2078
Belfield	ND	1055
Benedict	ND	67
Bergen	ND	7
Berlin	ND	35
Berthold	ND	501
Beulah	ND	3393
Binford	ND	174
Bisbee	ND	128
Bismarck	ND	75092
Blacktail	ND	0
Blanchard	ND	26
Bottineau	ND	2343
Bowbells	ND	377
Bowdon	ND	131
Bowman	ND	1744
Braddock	ND	20
Briarwood	ND	75
Brinsmade	ND	35
Brocket	ND	56
Brooktree Park	ND	80
Buchanan	ND	111
Bucyrus	ND	26
Buffalo	ND	192
Burlington	ND	1181
Butte	ND	69
Buxton	ND	316
Caledonia	ND	39
Calio	ND	21
Calvin	ND	19
Cando	ND	1122
Cannon Ball	ND	875
Canton City (Hensel)	ND	0
Carpio	ND	149
Carrington	ND	2072
Carson	ND	290
Casselton	ND	2521
Cathay	ND	42
Cavalier	ND	1244
Cayuga	ND	26
Center	ND	564
Christine	ND	153
Churchs Ferry	ND	12
Cleveland	ND	81
Clifford	ND	43
Cogswell	ND	98
Coleharbor	ND	85
Colfax	ND	145
Columbus	ND	155
Conway	ND	22
Cooperstown	ND	945
Courtenay	ND	44
Crary	ND	142
Crosby	ND	1408
Crystal	ND	131
Dahlen	ND	18
Davenport	ND	253
Dawson	ND	61
Dazey	ND	102
De Lamere	ND	30
Deering	ND	116
Denhoff	ND	20
Des Lacs	ND	204
Devils Lake	ND	7351
Dickey	ND	42
Dickinson	ND	23765
Dodge	ND	105
Donnybrook	ND	55
Douglas	ND	61
Drake	ND	288
Drayton	ND	785
Driscoll	ND	82
Dunn Center	ND	197
Dunseith	ND	797
Dwight	ND	80
East Dunseith	ND	500
East Fairview	ND	76
Edgeley	ND	552
Edinburg	ND	189
Edmore	ND	177
Egeland	ND	28
Elgin	ND	633
Ellendale	ND	1299
Elliott	ND	25
Embden	ND	59
Emerado	ND	431
Enderlin	ND	872
Englevale	ND	40
Epping	ND	85
Erie	ND	50
Esmond	ND	99
Fairdale	ND	37
Fairmount	ND	361
Fargo	ND	118523
Fessenden	ND	472
Fingal	ND	95
Finley	ND	437
Flasher	ND	216
Flaxton	ND	72
Forbes	ND	53
Fordville	ND	206
Forest River	ND	122
Forman	ND	513
Fort Ransom	ND	78
Fort Totten	ND	1243
Fort Yates	ND	191
Fortuna	ND	23
Four Bears	ND	0
Four Bears Village	ND	517
Foxholm	ND	75
Fredonia	ND	44
Frontier	ND	213
Fullerton	ND	53
Gackle	ND	291
Galesburg	ND	106
Gardena	ND	30
Gardner	ND	76
Garrison	ND	1538
Gascoyne	ND	16
Gilby	ND	232
Gladstone	ND	358
Glen Ullin	ND	743
Glenburn	ND	456
Glenfield	ND	91
Golden Valley	ND	183
Golva	ND	67
Goodrich	ND	96
Grace	ND	0
Grace City	ND	63
Grafton	ND	4243
Grand Forks	ND	57011
Grand Forks AFB	ND	0
Grand Forks Air Force Base	ND	2367
Grandin	ND	174
Grano	ND	7
Granville	ND	269
Great Bend	ND	59
Green Acres	ND	575
Grenora	ND	250
Gwinner	ND	834
Hague	ND	67
Halliday	ND	221
Hamberg	ND	21
Hamilton	ND	60
Hampden	ND	47
Hankinson	ND	908
Hanks	ND	9
Hannaford	ND	125
Hannah	ND	14
Hansboro	ND	12
Harmon	ND	145
Harvey	ND	1779
Harwood	ND	788
Hatton	ND	765
Havana	ND	71
Haynes	ND	22
Hazelton	ND	223
Hazen	ND	2488
Hebron	ND	691
Heil	ND	15
Heimdal	ND	27
Hensel	ND	64
Hettinger	ND	1257
Hillsboro	ND	1580
Hoople	ND	233
Hope	ND	264
Horace	ND	2545
Hove Mobile Park	ND	2
Hunter	ND	267
Hurdsfield	ND	83
Inkster	ND	48
Jamestown	ND	15422
Jessie	ND	25
Jud	ND	73
Karlsruhe	ND	86
Kathryn	ND	51
Kenmare	ND	1083
Kensal	ND	160
Kief	ND	14
Killdeer	ND	1254
Kindred	ND	728
Knox	ND	25
Kramer	ND	30
Kulm	ND	344
Lakota	ND	646
LaMoure	ND	914
Landa	ND	39
Langdon	ND	1787
Lankin	ND	94
Lansford	ND	254
Larimore	ND	1313
Larson	ND	12
Lawton	ND	30
Leal	ND	20
Leeds	ND	445
Lehr	ND	78
Leith	ND	16
Leonard	ND	227
Lidgerwood	ND	629
Lignite	ND	253
Lincoln	ND	3519
Linton	ND	1039
Lisbon	ND	2145
Litchville	ND	171
Logan	ND	194
Loma	ND	15
Long Creek	ND	0
Loraine	ND	9
Ludden	ND	22
Luverne	ND	31
Maddock	ND	382
Makoti	ND	148
Mandan	ND	21382
Mandaree	ND	596
Manning	ND	74
Mantador	ND	62
Manvel	ND	375
Mapleton	ND	875
Marion	ND	133
Marmarth	ND	143
Martin	ND	77
Max	ND	342
Maxbass	ND	86
Mayville	ND	1829
Maza	ND	4
McClusky	ND	375
McGregor	ND	0
McHenry	ND	56
McLeod	ND	27
McVille	ND	336
Medina	ND	303
Medora	ND	133
Menoken	ND	70
Mercer	ND	97
Merricourt	ND	9
Michigan	ND	348
Milnor	ND	648
Milton	ND	55
Minnewaukan	ND	224
Minot	ND	49450
Minot AFB	ND	0
Minot Air Force Base	ND	5521
Minto	ND	610
Mohall	ND	808
Monango	ND	35
Montpelier	ND	87
Mooreton	ND	194
Mott	ND	793
Mountain	ND	88
Munich	ND	202
Mylo	ND	20
Napoleon	ND	787
Nash	ND	32
Neche	ND	359
Nekoma	ND	47
New	ND	0
New England	ND	659
New Leipzig	ND	219
New Rockford	ND	1390
New Salem	ND	896
New Town	ND	2521
Newburg	ND	115
Niagara	ND	51
Nome	ND	61
Noonan	ND	126
North River	ND	56
Northwood	ND	927
Oakes	ND	1797
Oberon	ND	104
Oriska	ND	125
Orrin	ND	22
Osnabrock	ND	122
Overly	ND	18
Oxbow	ND	305
Page	ND	240
Palermo	ND	84
Park River	ND	1375
Parshall	ND	1263
Pekin	ND	66
Pembina	ND	565
Perth	ND	9
Petersburg	ND	180
Pettibone	ND	69
Pick	ND	0
Pick City	ND	138
Pillsbury	ND	12
Pingree	ND	59
Pisek	ND	102
Plaza	ND	193
Porcupine	ND	146
Portal	ND	157
Portland	ND	592
Powers Lake	ND	307
Prairie Rose	ND	73
Raleigh	ND	12
Rawson	ND	5
Ray	ND	729
Reeder	ND	159
Regan	ND	44
Regent	ND	173
Reile's Acres	ND	0
Reiles Acres	ND	513
Reynolds	ND	300
Rhame	ND	177
Richardton	ND	563
Riverdale	ND	227
Robinson	ND	37
Rock Lake	ND	177
Rocklake	ND	0
Rogers	ND	45
Rolette	ND	612
Rolla	ND	1325
Ross	ND	110
Rugby	ND	2846
Ruso	ND	4
Russell	ND	14
Ruthville	ND	191
Rutland	ND	160
Ryder	ND	82
Saint John	ND	341
Saint Thomas	ND	331
Sanborn	ND	191
Sarles	ND	27
Sawyer	ND	346
Scranton	ND	288
Selfridge	ND	168
Selz	ND	46
Sentinel Butte	ND	61
Sharon	ND	94
Sheldon	ND	124
Shell Valley	ND	1197
Sherwood	ND	251
Sheyenne	ND	200
Sibley	ND	30
Solen	ND	88
Souris	ND	60
South Heart	ND	428
Spiritwood	ND	18
Spiritwood Lake	ND	96
Spring Brook	ND	27
Springbrook	ND	0
St. John	ND	0
St. Thomas	ND	0
Stanley	ND	2721
Stanton	ND	370
Starkweather	ND	117
Steele	ND	709
Strasburg	ND	392
Streeter	ND	170
Surrey	ND	1358
Sutton	ND	17
Sykeston	ND	115
Tappen	ND	200
Taylor	ND	177
Thompson	ND	1005
Tioga	ND	1643
Tolley	ND	48
Tolna	ND	156
Tower	ND	0
Tower City	ND	258
Towner	ND	564
Trenton	ND	0
Turtle Lake	ND	590
Tuttle	ND	80
Underwood	ND	775
Upham	ND	142
Valley	ND	0
Valley City	ND	6669
Velva	ND	1260
Venturia	ND	10
Verona	ND	86
Voltaire	ND	42
Wahpeton	ND	7899
Walcott	ND	234
Wales	ND	29
Walhalla	ND	951
Warwick	ND	64
Washburn	ND	1309
Watford	ND	0
Watford City	ND	6708
West Fargo	ND	33597
Westhope	ND	428
Wheatland	ND	68
Wheelock	ND	22
White Earth	ND	92
White Shield	ND	336
Wildrose	ND	98
Williston	ND	26977
Willow	ND	0
Willow City	ND	167
Wilton	ND	725
Wimbledon	ND	213
Wing	ND	155
Wishek	ND	988
Wolford	ND	35
Woodworth	ND	49
Wyndmere	ND	418
York	ND	23
Ypsilanti	ND	104
Zap	ND	247
Zeeland	ND	85
Abie	NE	67
Adams	NE	596
Agnew	NE	0
Ainsworth	NE	1626
Albion	NE	1589
Alda	NE	655
Alexandria	NE	175
Allen	NE	364
Alliance	NE	8522
Alma	NE	1146
Alvo	NE	131
Ames	NE	14
Amherst	NE	248
Anoka	NE	6
Anselmo	NE	143
Ansley	NE	426
Arapahoe	NE	1010
Arcadia	NE	303
Archer	NE	81
Arlington	NE	1246
Arnold	NE	580
Arthur	NE	117
Ashland	NE	2558
Ashton	NE	191
Aten	NE	112
Atkinson	NE	1241
Atlanta	NE	131
Auburn	NE	3339
Aurora	NE	4496
Avoca	NE	241
Axtell	NE	736
Ayr	NE	94
Bancroft	NE	480
Barada	NE	23
Barneston	NE	114
Bartlett	NE	109
Bartley	NE	277
Bassett	NE	557
Battle Creek	NE	1193
Bayard	NE	1148
Bazile Mills	NE	28
Beacon View	NE	0
Beatrice	NE	12388
Beaver	NE	0
Beaver City	NE	591
Beaver Crossing	NE	407
Beaver Lake	NE	0
Bee	NE	193
Beemer	NE	671
Belden	NE	112
Belgrade	NE	118
Bellevue	NE	55510
Bellwood	NE	411
Belmar	NE	216
Belvidere	NE	47
Benedict	NE	234
Benkelman	NE	840
Bennet	NE	845
Bennington	NE	1669
Berea	NE	41
Bertrand	NE	738
Berwyn	NE	82
Big Springs	NE	392
Bladen	NE	227
Blair	NE	7975
Bloomfield	NE	977
Bloomington	NE	97
Blue Hill	NE	889
Blue Springs	NE	322
Boelus	NE	208
Bow Valley	NE	116
Boys	NE	0
Boys Town	NE	410
Bradshaw	NE	271
Brady	NE	415
Brainard	NE	322
Brewster	NE	18
Bridgeport	NE	1521
Bristow	NE	63
Broadwater	NE	124
Brock	NE	108
Broken Bow	NE	3551
Brownlee	NE	15
Brownville	NE	128
Brule	NE	309
Bruning	NE	276
Bruno	NE	96
Brunswick	NE	136
Buccaneer Bay	NE	0
Burchard	NE	78
Burr	NE	58
Burton	NE	10
Burwell	NE	1211
Bushnell	NE	121
Butte	NE	310
Byron	NE	82
Cairo	NE	807
Callaway	NE	522
Cambridge	NE	1051
Campbell	NE	306
Carleton	NE	90
Carroll	NE	222
Cedar Bluffs	NE	595
Cedar Creek	NE	397
Cedar Rapids	NE	368
Center	NE	93
Central	NE	0
Central City	NE	2886
Ceresco	NE	897
Chadron	NE	5775
Chalco	NE	10994
Chambers	NE	265
Champion	NE	103
Chapman	NE	285
Chappell	NE	921
Cheney	NE	0
Chester	NE	230
Clarks	NE	353
Clarkson	NE	633
Clatonia	NE	227
Clay Center	NE	730
Clearwater	NE	404
Clinton	NE	40
Cody	NE	157
Coleridge	NE	454
Colon	NE	109
Columbus	NE	22797
Comstock	NE	92
Concord	NE	160
Cook	NE	316
Cordova	NE	137
Cornlea	NE	36
Cortland	NE	475
Cotesfield	NE	45
Cowles	NE	28
Cozad	NE	3863
Crab Orchard	NE	37
Craig	NE	191
Crawford	NE	973
Creighton	NE	1120
Creston	NE	203
Crete	NE	7037
Crofton	NE	691
Crookston	NE	70
Culbertson	NE	590
Curtis	NE	897
Cushing	NE	32
Dakota	NE	0
Dakota City	NE	1906
Dalton	NE	314
Danbury	NE	99
Dannebrog	NE	302
Davenport	NE	291
Davey	NE	154
David	NE	0
David City	NE	2836
Dawson	NE	142
Daykin	NE	162
De Witt	NE	504
Decatur	NE	468
Denton	NE	201
Deshler	NE	750
Deweese	NE	65
Diller	NE	259
Dix	NE	250
Dixon	NE	84
Dodge	NE	597
Doniphan	NE	847
Dorchester	NE	576
Douglas	NE	173
Du Bois	NE	141
Dunbar	NE	189
Duncan	NE	368
Dunning	NE	106
Dwight	NE	197
Eagle	NE	1047
Eddyville	NE	95
Edgar	NE	481
Edison	NE	131
Elba	NE	215
Elgin	NE	632
Elk Creek	NE	97
Elkhorn	NE	8251
Elm Creek	NE	958
Elmwood	NE	639
Elsie	NE	106
Elwood	NE	682
Elyria	NE	50
Emerald	NE	0
Emerson	NE	818
Emmet	NE	47
Enders	NE	42
Endicott	NE	128
Ericson	NE	87
Eustis	NE	374
Ewing	NE	377
Exeter	NE	538
Fairbury	NE	3751
Fairfield	NE	373
Fairmont	NE	538
Falls	NE	0
Falls City	NE	4198
Farnam	NE	167
Farwell	NE	121
Filley	NE	130
Firth	NE	586
Fontanelle	NE	54
Fordyce	NE	135
Fort Calhoun	NE	917
Foster	NE	50
Franklin	NE	920
Fremont	NE	26474
Friend	NE	1013
Fullerton	NE	1266
Funk	NE	194
Gandy	NE	32
Garland	NE	220
Garrison	NE	52
Geneva	NE	2131
Genoa	NE	958
Gering	NE	8334
Gibbon	NE	1879
Gilead	NE	39
Giltner	NE	344
Glenvil	NE	298
Glenwood	NE	0
Goehner	NE	156
Gordon	NE	1531
Gothenburg	NE	3514
Grafton	NE	120
Grainton	NE	15
Grand Island	NE	51440
Grant	NE	1133
Greeley	NE	549
Greeley Center	NE	0
Greenwood	NE	571
Gresham	NE	223
Gretna	NE	5046
Gross	NE	2
Guide Rock	NE	209
Gurley	NE	214
Hadar	NE	301
Haigler	NE	147
Hallam	NE	229
Halsey	NE	78
Hamlet	NE	55
Hampton	NE	432
Harbine	NE	47
Hardy	NE	154
Harrisburg	NE	100
Harrison	NE	238
Hartington	NE	1506
Harvard	NE	982
Hastings	NE	24924
Hay Springs	NE	547
Hayes Center	NE	207
Hazard	NE	69
Heartwell	NE	71
Hebron	NE	1543
Hemingford	NE	801
Henderson	NE	997
Hendley	NE	24
Henry	NE	104
Herman	NE	265
Hershey	NE	666
Hickman	NE	2079
Hildreth	NE	346
Hillsborough	NE	7290
Holbrook	NE	202
Holdrege	NE	5561
Holmesville	NE	51
Holstein	NE	230
Homer	NE	541
Hooper	NE	829
Hordville	NE	144
Hoskins	NE	286
Howard City (Boelus)	NE	0
Howells	NE	554
Hubbard	NE	235
Hubbell	NE	67
Humboldt	NE	850
Humphrey	NE	792
Huntley	NE	44
Hyannis	NE	192
Imperial	NE	2056
Inavale	NE	117
Indianola	NE	564
Inglewood	NE	322
Inland	NE	62
Inman	NE	128
Ithaca	NE	151
Jackson	NE	217
Jansen	NE	114
Johnson	NE	328
Johnstown	NE	61
Julian	NE	57
Juniata	NE	820
Kearney	NE	33021
Kenesaw	NE	949
Kennard	NE	359
Keystone	NE	59
Kilgore	NE	78
Kimball	NE	2405
King Lake	NE	280
Kramer	NE	0
La Platte	NE	114
La Vista	NE	16921
Lake Waconda	NE	0
Lakeview	NE	0
Lamar	NE	23
Laurel	NE	935
Lawrence	NE	295
Lebanon	NE	78
Leigh	NE	403
Lemoyne	NE	82
Leshara	NE	111
Lewellen	NE	210
Lewiston	NE	64
Lexington	NE	10075
Liberty	NE	75
Lincoln	NE	294757
Lindsay	NE	255
Lindy	NE	13
Linoma Beach	NE	0
Linwood	NE	85
Lisco	NE	64
Litchfield	NE	258
Lodgepole	NE	317
Long Pine	NE	285
Loomis	NE	390
Lorenzo	NE	58
Loretto	NE	42
Lorton	NE	41
Louisville	NE	1174
Loup	NE	0
Loup City	NE	1012
Lushton	NE	30
Lyman	NE	326
Lynch	NE	230
Lyons	NE	815
Macy	NE	1023
Madison	NE	2371
Madrid	NE	236
Magnet	NE	55
Malcolm	NE	401
Malmo	NE	118
Manley	NE	163
Marquette	NE	232
Marsland	NE	9
Martell	NE	0
Martin	NE	92
Martinsburg	NE	90
Maskell	NE	73
Mason	NE	0
Mason City	NE	168
Max	NE	57
Maxwell	NE	304
Maywood	NE	248
McCook	NE	7580
McCool Junction	NE	409
McGrew	NE	103
McLean	NE	36
Mead	NE	557
Meadow Grove	NE	300
Melbeta	NE	110
Melia	NE	0
Memphis	NE	115
Merna	NE	362
Merriman	NE	130
Milford	NE	2107
Miller	NE	138
Milligan	NE	272
Minatare	NE	800
Minden	NE	3006
Mitchell	NE	1666
Monowi	NE	1
Monroe	NE	288
Moorefield	NE	30
Morrill	NE	912
Morse Bluff	NE	135
Mullen	NE	499
Murdock	NE	235
Murray	NE	472
Naper	NE	81
Naponee	NE	100
Nebraska	NE	0
Nebraska City	NE	7335
Nehawka	NE	203
Neligh	NE	1527
Nelson	NE	466
Nemaha	NE	144
Nenzel	NE	20
Newcastle	NE	322
Newman Grove	NE	728
Newport	NE	88
Nickerson	NE	356
Niobrara	NE	350
Nora	NE	20
Norfolk	NE	24366
Norman	NE	43
North Bend	NE	1234
North Loup	NE	289
North Platte	NE	24194
O'Neill	NE	3653
Oak	NE	64
Oakdale	NE	299
Oakland	NE	1202
Obert	NE	22
Oconto	NE	149
Octavia	NE	123
Odell	NE	303
Odessa	NE	130
Offutt AFB	NE	0
Offutt Air Force Base	NE	4644
Ogallala	NE	4570
Ohiowa	NE	110
Omaha	NE	486051
Ong	NE	61
Orchard	NE	355
Ord	NE	2061
Orleans	NE	384
Osceola	NE	850
Oshkosh	NE	828
Osmond	NE	763
Otoe	NE	172
Overland	NE	153
Overton	NE	573
Oxford	NE	764
Page	NE	164
Palisade	NE	349
Palmer	NE	471
Palmyra	NE	559
Panama	NE	281
Papillion	NE	19510
Parks	NE	23
Pawnee	NE	0
Pawnee City	NE	827
Paxton	NE	500
Pender	NE	1051
Peru	NE	798
Petersburg	NE	323
Phillips	NE	288
Pickrell	NE	196
Pierce	NE	1748
Pilger	NE	351
Pine Ridge	NE	14
Plainview	NE	1221
Platte Center	NE	338
Plattsmouth	NE	6462
Pleasant Dale	NE	210
Pleasanton	NE	349
Plymouth	NE	387
Polk	NE	304
Ponca	NE	940
Poole	NE	19
Potter	NE	331
Prague	NE	299
Prairie Home	NE	0
Preston	NE	27
Primrose	NE	59
Princeton	NE	0
Prosser	NE	71
Raeville	NE	22
Ragan	NE	38
Ralston	NE	5994
Randolph	NE	920
Ravenna	NE	1373
Raymond	NE	185
Red Cloud	NE	963
Republican	NE	0
Republican City	NE	154
Reynolds	NE	67
Richfield	NE	43
Richland	NE	73
Rising	NE	0
Rising City	NE	361
Riverdale	NE	185
Riverton	NE	84
Roca	NE	266
Rockville	NE	104
Rogers	NE	94
Rosalie	NE	163
Roscoe	NE	63
Roseland	NE	254
Royal	NE	60
Rulo	NE	165
Rushville	NE	850
Ruskin	NE	119
Saint Edward	NE	705
Saint Helena	NE	96
Saint Libory	NE	264
Saint Paul	NE	2290
Salem	NE	109
Santee	NE	344
Sarben	NE	31
Sargent	NE	509
Saronville	NE	45
Schuyler	NE	6171
Scotia	NE	297
Scottsbluff	NE	14802
Scribner	NE	846
Seneca	NE	33
Seward	NE	7167
Shelby	NE	685
Shelton	NE	1064
Shickley	NE	328
Sholes	NE	20
Shubert	NE	146
Sidney	NE	6942
Silver Creek	NE	362
Smithfield	NE	51
Snyder	NE	298
South Bend	NE	99
South Sioux	NE	0
South Sioux City	NE	13319
Spalding	NE	458
Spencer	NE	433
Sprague	NE	146
Springfield	NE	1584
Springview	NE	236
St. Edward	NE	0
St. Helena	NE	0
St. Libory	NE	0
St. Paul	NE	0
Stamford	NE	185
Stanton	NE	1519
Staplehurst	NE	242
Stapleton	NE	311
Steele	NE	0
Steele City	NE	59
Steinauer	NE	71
Stella	NE	148
Sterling	NE	460
Stockham	NE	44
Stockville	NE	24
Strang	NE	28
Stratton	NE	338
Stromsburg	NE	1132
Stuart	NE	597
Sumner	NE	231
Sunol	NE	73
Superior	NE	1884
Surprise	NE	43
Sutherland	NE	1336
Sutton	NE	1440
Swanton	NE	94
Syracuse	NE	1993
Table Rock	NE	255
Talmage	NE	237
Tamora	NE	58
Tarnov	NE	46
Taylor	NE	177
Tecumseh	NE	1626
Tekamah	NE	1743
Terrytown	NE	1172
Thayer	NE	62
Thedford	NE	200
Thurston	NE	134
Tilden	NE	939
Tobias	NE	106
Trenton	NE	561
Trumbull	NE	198
Tryon	NE	157
Uehling	NE	228
Ulysses	NE	165
Unadilla	NE	318
Union	NE	232
Upland	NE	135
Utica	NE	842
Valentine	NE	2836
Valley	NE	2117
Valparaiso	NE	552
Venango	NE	167
Venice	NE	75
Verdel	NE	30
Verdigre	NE	552
Verdon	NE	167
Virginia	NE	59
Waco	NE	244
Wahoo	NE	4511
Wakefield	NE	1403
Wallace	NE	359
Walthill	NE	777
Walton	NE	306
Wann	NE	86
Washington	NE	147
Waterbury	NE	70
Waterloo	NE	1044
Wauneta	NE	574
Wausa	NE	607
Waverly	NE	3739
Wayne	NE	5569
Weeping Water	NE	1057
Wellfleet	NE	77
West Point	NE	3368
Western	NE	235
Westerville	NE	39
Weston	NE	326
White Clay	NE	0
Whiteclay	NE	10
Whitney	NE	76
Wilber	NE	1870
Wilcox	NE	358
Willow Island	NE	26
Wilsonville	NE	91
Winnebago	NE	787
Winnetoon	NE	66
Winside	NE	409
Winslow	NE	106
Wisner	NE	1184
Wolbach	NE	262
Wood Lake	NE	64
Wood River	NE	1367
Woodland Hills	NE	0
Woodland Park	NE	0
Wymore	NE	1414
Wynot	NE	170
Yankee Hill	NE	292
York	NE	7864
Yutan	NE	1212
Acworth	NH	890
Albany	NH	697
Alexandria	NH	1415
Alstead	NH	2071
Alton	NH	501
Amherst	NH	613
Andover	NH	2246
Antrim	NH	1397
Ashland	NH	1244
Atkinson	NH	6782
Auburn	NH	5089
Barnstead	NH	4572
Barrington	NH	8417
Bartlett	NH	373
Bath	NH	951
Bedford	NH	21188
Belmont	NH	1301
Bennington	NH	381
Benton	NH	334
Berlin	NH	9367
Bethlehem	NH	972
Blodgett Landing	NH	101
Boscawen	NH	3911
Bow Bog	NH	8381
Bradford	NH	356
Brentwood	NH	3405
Bretton Woods	NH	107
Bridgewater	NH	1037
Bristol	NH	1688
Brookfield	NH	643
Brookline	NH	4650
Canaan	NH	524
Candia	NH	4405
Canterbury	NH	2108
Carroll	NH	706
Center Harbor	NH	1061
Center Ossipee	NH	561
Center Sandwich	NH	123
Charlestown	NH	1152
Chatham	NH	277
Chester	NH	5236
Chesterfield	NH	3773
Chichester	NH	2382
Claremont	NH	12984
Colebrook	NH	1394
Columbia	NH	799
Concord	NH	43976
Contoocook	NH	1444
Conway	NH	1823
Croydon	NH	704
Dalton	NH	987
Danbury	NH	1141
Danville	NH	4537
Deerfield	NH	4315
Deering	NH	1997
Derry	NH	22015
Derry Village	NH	34539
Dorchester	NH	376
Dover	NH	30880
Dublin	NH	1572
Dummer	NH	329
Durham	NH	10345
East Concord	NH	42605
East Kingston	NH	1900
East Merrimack	NH	4197
Easton	NH	273
Effingham	NH	1356
Ellsworth	NH	93
Enfield	NH	1540
Epping	NH	1681
Epsom	NH	4590
Errol	NH	317
Exeter	NH	9242
Farmington	NH	3885
Fitzwilliam	NH	2280
Francestown	NH	1571
Franconia	NH	984
Franklin	NH	8450
Freedom	NH	1388
Fremont	NH	3738
Gilford	NH	7849
Gilmanton	NH	3259
Gilsum	NH	828
Goffstown	NH	3196
Gorham	NH	1600
Goshen	NH	789
Grafton	NH	1212
Grantham	NH	2308
Greenfield	NH	1765
Greenland	NH	3417
Greenville	NH	1108
Groton	NH	486
Groveton	NH	1118
Hampstead	NH	8650
Hampton	NH	9656
Hampton Beach	NH	2275
Hampton Falls	NH	2002
Hancock	NH	204
Hanover	NH	8636
Harrisville	NH	1145
Haverhill	NH	4532
Hebron	NH	489
Henniker	NH	1747
Hill	NH	1057
Hillsborough	NH	1976
Hinsdale	NH	1548
Holderness	NH	2056
Hollis	NH	7711
Hooksett	NH	4147
Hopkinton	NH	5676
Hudson	NH	7336
Jackson	NH	889
Jaffrey	NH	2757
Jefferson	NH	1071
Keene	NH	23265
Kensington	NH	2016
Kingston	NH	6225
Klondike Corner	NH	0
Laconia	NH	16227
Lancaster	NH	1725
Langdon	NH	624
Lebanon	NH	13579
Lee	NH	4500
Lempster	NH	1034
Lincoln	NH	993
Lisbon	NH	980
Litchfield	NH	8307
Littleton	NH	4412
Livermore	NH	3
Londonderry	NH	11037
Loudon	NH	559
Lyme	NH	1788
Lyndeborough	NH	1688
Madbury	NH	1607
Madison	NH	2113
Manchester	NH	110229
Marlborough	NH	1094
Marlow	NH	796
Mason	NH	1222
Melvin	NH	0
Melvin Village	NH	241
Meredith	NH	1718
Merrimack	NH	26726
Milan	NH	1418
Milford	NH	8835
Milton	NH	575
Milton Mills	NH	299
Monroe	NH	808
Mont Vernon	NH	2166
Moultonborough	NH	5034
Mountain Lakes	NH	488
Nashua	NH	87970
Nelson	NH	675
New Boston	NH	4934
New Castle	NH	1076
New Durham	NH	2364
New Hampton	NH	351
New Ipswich	NH	5283
New London	NH	1415
Newbury	NH	1813
Newfields	NH	301
Newington	NH	825
Newmarket	NH	5297
Newport	NH	4769
Newton	NH	4513
North Conway	NH	2349
North Hampton	NH	4721
North Haverhill	NH	0
North Walpole	NH	828
North Woodstock	NH	528
Northfield	NH	5049
Northumberland	NH	2597
Northwood	NH	3877
Nottingham	NH	3942
Orange	NH	318
Orford	NH	1162
Ossipee	NH	4655
Pelham	NH	12676
Pembroke	NH	7461
Peterborough	NH	3103
Piermont	NH	755
Pinardville	NH	4780
Pittsburg	NH	923
Pittsfield	NH	1576
Plainfield	NH	205
Plaistow	NH	7885
Plymouth	NH	4456
Portsmouth	NH	21530
Randolph	NH	361
Raymond	NH	2855
Richmond	NH	1147
Rindge	NH	6049
Rochester	NH	30038
Rollinsford	NH	2820
Rumney	NH	1576
Rye	NH	5277
Salem	NH	29549
Salisbury	NH	1211
Sanbornton	NH	2749
Sanbornville	NH	1056
Sandown	NH	5827
Sandwich	NH	1370
Seabrook	NH	8679
Seabrook Beach	NH	992
Sharon	NH	383
Shelburne	NH	404
Somersworth	NH	11759
South Hampton	NH	899
South Hooksett	NH	5418
Springfield	NH	1007
Stark	NH	550
Stewartstown	NH	964
Stoddard	NH	988
Strafford	NH	3862
Stratford	NH	1003
Stratham Station	NH	6949
Sugar Hill	NH	600
Suissevale	NH	0
Sullivan	NH	795
Sunapee	NH	3254
Suncook	NH	5379
Surry	NH	717
Sutton	NH	1644
Swanzey	NH	7224
Tamworth	NH	2673
Temple	NH	1381
Thornton	NH	1963
Tilton	NH	3612
Tilton Northfield	NH	0
Tilton-Northfield	NH	3075
Troy	NH	1221
Tuftonboro	NH	2288
Union	NH	204
Unity	NH	1630
Wakefield	NH	4705
Walpole	NH	605
Warner	NH	444
Warren	NH	930
Washington	NH	953
Waterville Valley	NH	516
Weare	NH	8583
Webster	NH	1682
Wentworth	NH	850
West Stewartstown	NH	386
West Swanzey	NH	1308
Westmoreland	NH	1861
Whitefield	NH	1142
Wilmot	NH	1218
Wilton	NH	1163
Winchester	NH	1733
Windham	NH	13091
Wolfeboro	NH	2838
Woodstock	NH	1213
Woodsville	NH	1126
Absecon	NJ	8317
Absecon Highlands	NJ	0
Allamuchy	NJ	78
Allendale	NJ	6822
Allenhurst	NJ	491
Allentown	NJ	1825
Allenwood	NJ	925
Alloway	NJ	1402
Alpha	NJ	2303
Alpine	NJ	1917
Ampere North	NJ	0
Anderson	NJ	342
Andover	NJ	581
Annandale	NJ	1695
Arrowhead Lake	NJ	0
Asbury	NJ	273
Asbury Park	NJ	15818
Ashland	NJ	8302
Atco	NJ	12350
Atlantic	NJ	0
Atlantic City	NJ	39260
Atlantic Highlands	NJ	4311
Auburn	NJ	0
Audubon	NJ	8730
Audubon Park	NJ	1011
Avalon	NJ	1283
Avenel	NJ	17011
Avon-by-the-Sea	NJ	1794
Barclay	NJ	0
Bargaintown	NJ	0
Barnegat	NJ	2817
Barnegat Light	NJ	576
Barrington	NJ	6817
Basking Ridge	NJ	21424
Bay Head	NJ	972
Bayonne	NJ	66311
Bayville	NJ	20512
Beach Haven	NJ	1172
Beach Haven West	NJ	3896
Beachwood	NJ	11214
Beattystown	NJ	4554
Beckett	NJ	4847
Bedminster	NJ	8165
Beesleys Point	NJ	0
Belford	NJ	1768
Belle Mead	NJ	216
Belleplain	NJ	597
Belleville	NJ	36878
Bellmawr	NJ	11462
Belmar	NJ	5712
Belvidere	NJ	2607
Bergenfield	NJ	27621
Berkeley Heights	NJ	14179
Berlin	NJ	7590
Bernardsville	NJ	7801
Beverly	NJ	2559
Blackwells Mills	NJ	803
Blackwood	NJ	4545
Blairstown	NJ	515
Blawenburg	NJ	280
Bloomfield	NJ	49120
Bloomingdale	NJ	8215
Bloomsbury	NJ	848
Bogota	NJ	8400
Boonton	NJ	8441
Bordentown	NJ	3882
Borough of Far Hills	NJ	919
Bound Brook	NJ	10497
Bradley Beach	NJ	4268
Bradley Gardens	NJ	14206
Brainards	NJ	202
Branchville	NJ	802
Brass Castle	NJ	1555
Brick	NJ	76021
Bridgeport	NJ	0
Bridgeton	NJ	25031
Bridgeville	NJ	106
Bridgewater	NJ	44464
Bridgewater Center	NJ	0
Brielle	NJ	4757
Brigantine	NJ	9204
Broadway	NJ	244
Brookdale	NJ	9239
Brookfield	NJ	675
Brooklawn	NJ	1933
Brookside	NJ	0
Browns Mills	NJ	11223
Brownville	NJ	2383
Budd Lake	NJ	8968
Buena	NJ	4603
Burleigh	NJ	725
Burlington	NJ	9808
Butler	NJ	7701
Buttzville	NJ	146
Byram Center	NJ	90
Caldwell	NJ	7948
Califon	NJ	1080
Camden	NJ	76119
Cape May	NJ	3514
Cape May Court House	NJ	5338
Cape May Point	NJ	281
Carlls Corner	NJ	0
Carlstadt	NJ	6279
Carneys Point	NJ	7382
Carteret	NJ	24170
Cedar Glen Lakes	NJ	1421
Cedar Glen West	NJ	1267
Cedar Grove	NJ	12457
Cedar Knolls	NJ	4000
Cedarville	NJ	776
Centre Grove	NJ	0
Chatham	NJ	8993
Cherry Hill	NJ	70475
Cherry Hill Mall	NJ	14171
Chesilhurst	NJ	1634
Chester	NJ	1675
Cinnaminson	NJ	14646
Clark	NJ	14628
Clayton	NJ	8493
Clearbrook	NJ	0
Clearbrook Park	NJ	2667
Clementon	NJ	4947
Cliffside Park	NJ	24857
Cliffwood Beach	NJ	3194
Clifton	NJ	86334
Clinton	NJ	2657
Closter	NJ	8662
Clyde	NJ	213
Collings Lakes	NJ	1706
Collingswood	NJ	14000
Cologne	NJ	0
Colonia	NJ	17795
Colts Neck	NJ	10142
Columbia	NJ	229
Columbus	NJ	8783
Concordia	NJ	3092
Connecticut Farms	NJ	0
Cookstown	NJ	0
Corbin	NJ	0
Corbin City	NJ	492
Country Lake Estates	NJ	3943
Cranbury	NJ	2181
Crandon Lakes	NJ	1178
Cranford	NJ	22627
Cream Ridge	NJ	0
Cresskill	NJ	8812
Crestwood	NJ	0
Crestwood Village	NJ	7907
Crosswicks	NJ	0
Cumberland-Hesstown	NJ	0
Dayton	NJ	7063
Deal	NJ	738
Deans	NJ	0
Deerfield Street	NJ	0
Delanco	NJ	3211
Delaware	NJ	150
Delaware Park	NJ	0
Delmont	NJ	0
Demarest	NJ	5050
Dennisville	NJ	0
Denville	NJ	16669
Diamond Beach	NJ	136
Dividing Creek	NJ	0
Dorchester	NJ	0
Dorothy	NJ	0
Dover	NJ	18346
Dover Beaches North	NJ	1239
Dover Beaches South	NJ	1209
Dumont	NJ	18001
Dunellen	NJ	7431
Dutch Neck	NJ	0
East Brunswick	NJ	48495
East Franklin	NJ	8669
East Freehold	NJ	4894
East Hanover	NJ	12194
East Millstone	NJ	579
East Newark	NJ	2406
East Orange	NJ	64949
East Rocky Hill	NJ	469
East Rutherford	NJ	9164
East Vineland	NJ	0
Eatontown	NJ	12301
Echelon	NJ	10743
Edgewater	NJ	12034
Edgewater Park	NJ	7387
Edison	NJ	102548
Egg Harbor	NJ	0
Egg Harbor City	NJ	4239
Elizabeth	NJ	129007
Ellisburg	NJ	4413
Elmer	NJ	1343
Elmwood Park	NJ	20279
Elwood	NJ	1437
Emerson	NJ	7697
Encore at Monroe	NJ	0
Englewood	NJ	28539
Englewood Cliffs	NJ	5403
English Creek	NJ	0
Englishtown	NJ	1955
Erma	NJ	2134
Essex Fells	NJ	2159
Estell Manor	NJ	1731
Ewing	NJ	36559
Fair Haven	NJ	6029
Fair Lawn	NJ	33597
Fairfield	NJ	7063
Fairton	NJ	1264
Fairview	NJ	14451
Fanwood	NJ	7651
Far Hills	NJ	930
Farmingdale	NJ	1306
Fieldsboro	NJ	532
Finderne	NJ	5600
Finesville	NJ	175
Flagtown	NJ	0
Flanders	NJ	0
Flemington	NJ	4641
Florence	NJ	4426
Florham Park	NJ	11835
Folsom	NJ	1851
Fords	NJ	15187
Forked River	NJ	5244
Forsgate	NJ	0
Fort Dix	NJ	7716
Fort Lee	NJ	36672
Fortescue	NJ	0
Franklin	NJ	4855
Franklin Center	NJ	4460
Franklin Lakes	NJ	10899
Franklin Park	NJ	13295
Franklinville	NJ	0
Freehold	NJ	11959
Frenchtown	NJ	1386
Gandys Beach	NJ	0
Garfield	NJ	31802
Garwood	NJ	4351
Germania	NJ	0
Gibbsboro	NJ	2244
Gibbstown	NJ	3739
Gillette	NJ	0
Gladstone	NJ	2086
Glassboro	NJ	19216
Glen Gardner	NJ	1663
Glen Ridge	NJ	7660
Glen Rock	NJ	11999
Glendora	NJ	4750
Gloucester	NJ	0
Gloucester City	NJ	11329
Golden Triangle	NJ	4145
Goshen	NJ	0
Gouldtown	NJ	0
Great Meadows	NJ	303
Great Notch	NJ	0
Green	NJ	0
Green Knoll	NJ	6200
Greentree	NJ	11367
Greenwich	NJ	0
Grenloch	NJ	0
Griggstown	NJ	819
Groveville	NJ	2945
Guttenberg	NJ	11665
Hackensack	NJ	44834
Hackettstown	NJ	9579
Haddon Heights	NJ	7514
Haddonfield	NJ	11414
Hainesburg	NJ	91
Haledon	NJ	8451
Hamburg	NJ	3155
Hamilton Square	NJ	12784
Hammonton	NJ	14618
Hampton	NJ	1361
Hancocks Bridge	NJ	254
Hanover	NJ	12898
Hardwick	NJ	1464
Harlingen	NJ	297
Harmony	NJ	441
Harrington Park	NJ	4823
Harrison	NJ	15474
Harrisonville	NJ	0
Harvey Cedars	NJ	341
Hasbrouck Heights	NJ	12227
Haskell	NJ	4942
Haworth	NJ	3470
Hawthorne	NJ	19074
Heathcote	NJ	5821
Heislerville	NJ	0
Helmetta	NJ	2231
Hewitt	NJ	0
Hi-Nella	NJ	860
Hibernia	NJ	0
High Bridge	NJ	3556
Highland Lake	NJ	4933
Highland Lakes	NJ	0
Highland Park	NJ	14347
Highlands	NJ	4867
Hightstown	NJ	5517
Hillsborough	NJ	38303
Hillsdale	NJ	10559
Hillside	NJ	22155
Ho-Ho-Kus	NJ	4165
Hoboken	NJ	53635
Holiday City South	NJ	3689
Holiday City-Berkeley	NJ	12831
Holiday Heights	NJ	2099
Hopatcong	NJ	14510
Hopatcong Hills	NJ	16267
Hope	NJ	195
Hopelawn	NJ	0
Hopewell	NJ	1929
Hutchinson	NJ	135
Interlaken	NJ	808
Irvington	NJ	61323
Iselin	NJ	18695
Island Heights	NJ	1668
Jackson	NJ	54856
Jamesburg	NJ	6029
Jersey	NJ	0
Jersey City	NJ	264290
Jobstown	NJ	0
Johnsonburg	NJ	101
Juliustown	NJ	429
Kean University	NJ	0
Keansburg	NJ	9873
Kearny	NJ	42137
Keasbey	NJ	0
Kendall Park	NJ	9339
Kenilworth	NJ	8215
Kenvil	NJ	3009
Keyport	NJ	7145
Kingston	NJ	1493
Kingston Estates	NJ	5685
Kinnelon	NJ	10392
Lake Como	NJ	1759
Lake Hiawatha	NJ	9360
Lake Hopatcong	NJ	9054
Lake Mohawk	NJ	9916
Lake Telemark	NJ	1255
Lakehurst	NJ	2694
Lakeside-Beebe Run	NJ	0
Lakewood	NJ	53805
Lambertville	NJ	3833
Lamington	NJ	0
Landing	NJ	6436
Laurel Heights	NJ	0
Laurel Lake	NJ	2989
Laurel Springs	NJ	1884
Laurence Harbor	NJ	6536
Lavallette	NJ	1807
Lawnside	NJ	2919
Lawrenceville	NJ	3887
Layton	NJ	0
Lebanon	NJ	1671
Ledgewood	NJ	0
Leeds Point	NJ	0
Leesburg	NJ	0
Leisure	NJ	0
Leisure Knoll	NJ	2490
Leisure Village	NJ	4400
Leisure Village East	NJ	4217
Leisure Village West	NJ	0
Leisure Village West-Pine Lake Park	NJ	3493
Leisuretowne	NJ	3582
Leonardo	NJ	2757
Leonia	NJ	9219
Liberty Corner	NJ	0
Lincoln Park	NJ	10405
Lincroft	NJ	6135
Linden	NJ	42021
Lindenwold	NJ	17613
Linwood	NJ	6973
Little Falls	NJ	10688
Little Ferry	NJ	10963
Little Silver	NJ	5913
Livingston	NJ	27853
Llewellyn Park	NJ	0
Loch Arbour	NJ	187
Lodi	NJ	24835
Long Branch	NJ	30941
Long Valley	NJ	1879
Longport	NJ	886
Lopatcong Overlook	NJ	734
Lower Berkshire Valley	NJ	0
Lumberton	NJ	12559
Lyndhurst	NJ	19996
Lyons	NJ	0
Macopin	NJ	0
Madison	NJ	16126
Madison Park	NJ	7144
Magnolia	NJ	4383
Mahwah	NJ	24062
Malaga	NJ	0
Manahawkin	NJ	2303
Manasquan	NJ	5815
Mantoloking	NJ	253
Manville	NJ	10429
Maple Shade	NJ	19077
Maplewood	NJ	25008
Margate	NJ	0
Margate City	NJ	6237
Marksboro	NJ	82
Marlboro	NJ	40191
Marlton	NJ	10133
Marmora	NJ	0
Marshallville	NJ	0
Martinsville	NJ	11980
Matawan	NJ	8853
Mauricetown	NJ	0
Mays Landing	NJ	2135
Maywood	NJ	9805
McGuire AFB	NJ	3710
McKee	NJ	0
Medford Lakes	NJ	4146
Mendham	NJ	5001
Menlo Park Terrace	NJ	0
Mercerville	NJ	13230
Mercerville-Hamilton Square	NJ	26419
Merchantville	NJ	3821
Metuchen	NJ	13886
Mickleton	NJ	0
Middlebush	NJ	2326
Middlesex	NJ	13934
Middletown	NJ	65490
Midland Park	NJ	7329
Milford	NJ	1204
Millburn	NJ	20149
Millington	NJ	0
Millstone	NJ	419
Milltown	NJ	7049
Millville	NJ	28230
Milmay	NJ	0
Mizpah	NJ	0
Money Island	NJ	0
Monmouth Beach	NJ	3239
Monmouth Junction	NJ	2887
Monroe Manor	NJ	0
Montclair	NJ	39701
Montclair State University	NJ	0
Montvale	NJ	8442
Moonachie	NJ	2788
Moorestown-Lenola	NJ	14217
Morganville	NJ	5040
Morris Plains	NJ	5532
Morristown	NJ	18594
Mount Arlington	NJ	5300
Mount Ephraim	NJ	4639
Mount Hermon	NJ	141
Mount Holly	NJ	10804
Mount Hope	NJ	0
Mount Laurel	NJ	41864
Mount Royal	NJ	0
Mount Tabor	NJ	0
Mountain Lake	NJ	0
Mountain Lakes	NJ	4288
Mountainside	NJ	6885
Mullica Hill	NJ	3982
Mystic Island	NJ	8493
National Park	NJ	2999
Navesink	NJ	2020
Neptune	NJ	0
Neptune City	NJ	4803
Nesco	NJ	0
Neshanic	NJ	0
Neshanic Station	NJ	0
Netcong	NJ	3253
New	NJ	0
New Brunswick	NJ	57035
New Egypt	NJ	2512
New Gretna	NJ	0
New Milford	NJ	16801
New Providence	NJ	12469
New Vernon	NJ	0
New Village	NJ	421
Newark	NJ	281944
Newfield	NJ	1534
Newfoundland	NJ	0
Newport	NJ	0
Newton	NJ	7979
Newtonville	NJ	0
North Arlington	NJ	15904
North Beach Haven	NJ	2235
North Bergen	NJ	63484
North Brunswick	NJ	43905
North Caldwell	NJ	6661
North Cape May	NJ	3226
North Haledon	NJ	8548
North Middletown	NJ	3295
North Plainfield	NJ	22140
North Wildwood	NJ	3901
Northfield	NJ	8521
Northvale	NJ	4859
Norwood	NJ	5869
Nutley	NJ	27572
Oak Ridge	NJ	0
Oak Valley	NJ	3483
Oakhurst	NJ	3995
Oakland	NJ	13165
Oaklyn	NJ	3992
Ocean	NJ	0
Ocean Acres	NJ	16142
Ocean City	NJ	11355
Ocean Gate	NJ	2010
Ocean Grove	NJ	3342
Ocean View	NJ	0
Oceanport	NJ	5739
Oceanville	NJ	0
Ogdensburg	NJ	2286
Old Bridge	NJ	23753
Old Tappan	NJ	6016
Oldwick	NJ	0
Olivet	NJ	1408
Oradell	NJ	8218
Orange	NJ	34457
Othello	NJ	0
Oxford	NJ	1090
Packanack Lake	NJ	0
Palermo	NJ	0
Palisades Park	NJ	20743
Palmyra	NJ	7314
Panther Valley	NJ	0
Paramus	NJ	26974
Park Ridge	NJ	8919
Parsippany	NJ	51144
Passaic	NJ	71085
Paterson	NJ	147754
Paulsboro	NJ	5989
Peapack	NJ	2086
Peapack and Gladstone	NJ	0
Pedricktown	NJ	524
Pemberton	NJ	1383
Pemberton Heights	NJ	2423
Pennington	NJ	2598
Penns Grove	NJ	4945
Pennsauken	NJ	36332
Pennsville	NJ	11888
Perth Amboy	NJ	52682
Phillipsburg	NJ	14515
Pine Beach	NJ	2150
Pine Brook	NJ	0
Pine Hill	NJ	10510
Pine Lake Park	NJ	8707
Pine Ridge at Crestwood	NJ	2369
Pine Valley	NJ	12
Pines Lake	NJ	0
Piscataway	NJ	56044
Pitman	NJ	8898
Plainfield	NJ	51217
Plainsboro Center	NJ	2712
Pleasant Plains	NJ	922
Pleasantdale	NJ	0
Pleasantville	NJ	20755
Pluckemin	NJ	0
Point Pleasant	NJ	18523
Point Pleasant Beach	NJ	4552
Pomona	NJ	7124
Pompton Lakes	NJ	11202
Pompton Plains	NJ	0
Port Colden	NJ	122
Port Elizabeth	NJ	0
Port Monmouth	NJ	3818
Port Morris	NJ	0
Port Murray	NJ	129
Port Norris	NJ	1377
Port Reading	NJ	3728
Port Republic	NJ	1100
Pottersville	NJ	0
Preakness	NJ	0
Presidential Lakes Estates	NJ	2365
Princeton	NJ	29603
Princeton Junction	NJ	2465
Princeton Meadows	NJ	13834
Prospect Park	NJ	5953
Quinton	NJ	588
Rahway	NJ	29508
Rainbow Lakes	NJ	0
Ramapo College of New Jersey	NJ	0
Ramblewood	NJ	5907
Ramsey	NJ	15102
Ramtown	NJ	6242
Randolph	NJ	25734
Raritan	NJ	8031
Red Bank	NJ	12204
Regency at Monroe	NJ	0
Renaissance at Monroe	NJ	0
Richland	NJ	0
Richwood	NJ	3459
Ridgefield	NJ	11373
Ridgefield Park	NJ	13102
Ridgewood	NJ	25621
Ringoes	NJ	0
Ringwood	NJ	12448
Rio Grande	NJ	2670
River Edge	NJ	11668
River Vale	NJ	9497
Riverdale	NJ	4273
Riverton	NJ	2748
Roadstown	NJ	0
Robbinsville	NJ	3041
Robbinsville Center	NJ	0
Robertsville	NJ	11297
Rochelle Park	NJ	5518
Rockaway	NJ	6494
Rockleigh	NJ	533
Rocky Hill	NJ	690
Roebling	NJ	3715
Roosevelt	NJ	871
Roseland	NJ	5876
Roselle	NJ	21670
Roselle Park	NJ	13670
Rosenhayn	NJ	1098
Ross Corner	NJ	13
Rossmoor	NJ	2666
Rumson	NJ	6926
Runnemede	NJ	8381
Rutgers University-Busch Campus	NJ	0
Rutgers University-Livingston Campus	NJ	0
Rutherford	NJ	18690
Saddle Brook	NJ	13130
Saddle River	NJ	3255
Salem	NJ	4894
Sayreville	NJ	44920
Sayreville Junction	NJ	42890
Scotch Plains	NJ	23584
Sea Bright	NJ	1344
Sea Girt	NJ	1811
Sea Isle	NJ	0
Sea Isle City	NJ	2087
Seabrook Farms	NJ	1484
Seaside Heights	NJ	2892
Seaside Park	NJ	1551
Seaville	NJ	0
Secaucus	NJ	19104
Seeley	NJ	0
Sewaren	NJ	2756
Sewell	NJ	37433
Shark River Hills	NJ	3697
Sheppards Mill	NJ	0
Shiloh	NJ	642
Ship Bottom	NJ	1135
Short Hills	NJ	13165
Shrewsbury	NJ	4131
Sicklerville	NJ	42891
Silver Lake	NJ	0
Silver Ridge	NJ	1133
Singac	NJ	3618
Six Mile Run	NJ	0
Sixmile Run	NJ	3184
Skillman	NJ	242
Smithville	NJ	7242
Society Hill	NJ	3829
Somerdale	NJ	5460
Somers Point	NJ	10688
Somerset	NJ	22083
Somerville	NJ	12202
South Amboy	NJ	8846
South Belmar	NJ	1789
South Bound Brook	NJ	4863
South Dennis	NJ	0
South Hackensack	NJ	2771
South Old Bridge	NJ	23233
South Orange	NJ	17295
South Plainfield	NJ	24290
South River	NJ	16399
South Seaville	NJ	0
South Toms River	NJ	3736
South Vineland	NJ	58122
Sparta	NJ	19722
Spotswood	NJ	8476
Spring Lake	NJ	2965
Spring Lake Heights	NJ	4713
Springdale	NJ	14518
Springfield	NJ	14429
Stanhope	NJ	3410
Stewartsville	NJ	349
Stirling	NJ	0
Stockton	NJ	524
Stockton University	NJ	0
Stone Harbor	NJ	836
Stonebridge	NJ	0
Stratford	NJ	7013
Strathmere	NJ	158
Strathmore	NJ	7258
Succasunna	NJ	9152
Summit	NJ	22074
Sunset Lake	NJ	0
Surf	NJ	0
Surf City	NJ	1204
Sussex	NJ	2043
Swedesboro	NJ	2613
Sweetwater	NJ	0
Tavistock	NJ	5
Teaneck	NJ	40078
Ten Mile Run	NJ	1959
Tenafly	NJ	14880
Teterboro	NJ	69
The College of New Jersey	NJ	0
The Hills	NJ	0
The Ponds	NJ	0
Thorofare	NJ	0
Three Bridges	NJ	0
Tinton Falls	NJ	17772
Titusville	NJ	0
Toms River	NJ	88791
Totowa	NJ	10973
Towaco	NJ	0
Trenton	NJ	89620
Troy Hills	NJ	0
Tuckahoe	NJ	0
Tuckerton	NJ	3377
Turnersville	NJ	3742
Twin Rivers	NJ	7443
Union	NJ	56771
Union Beach	NJ	5595
Union City	NJ	69156
Upper Greenwood Lake	NJ	0
Upper Montclair	NJ	11565
Upper Pohatcong	NJ	1781
Upper Saddle River	NJ	8379
Upper Stewartsville	NJ	212
Vauxhall	NJ	0
Ventnor	NJ	0
Ventnor City	NJ	10486
Vernon Center	NJ	1713
Vernon Valley	NJ	1626
Verona	NJ	13545
Victory Gardens	NJ	1532
Victory Lakes	NJ	2111
Vienna	NJ	981
Villas	NJ	9483
Vincentown	NJ	24664
Vineland	NJ	60818
Vista Center	NJ	2095
Voorhees	NJ	1517
Waldwick	NJ	10095
Wallington	NJ	11716
Wanamassa	NJ	4532
Wanaque	NJ	11848
Waretown	NJ	1569
Warren Township	NJ	15311
Washington	NJ	6498
Washington Crossing	NJ	0
Watchung	NJ	5916
Watsessing	NJ	0
Wayne	NJ	57915
Weehawken	NJ	14104
Wenonah	NJ	2254
West Belmar	NJ	2493
West Berlin	NJ	0
West Cape May	NJ	1016
West Freehold	NJ	13613
West Long Branch	NJ	7994
West Milford	NJ	26968
West New York	NJ	53366
West Orange	NJ	48131
West Park	NJ	0
West Wildwood	NJ	572
Westfield	NJ	30548
Westmont	NJ	0
Weston	NJ	1235
Westville	NJ	4439
Westwood	NJ	11247
Wharton	NJ	6613
Whippany	NJ	8822
White Horse	NJ	9494
White House Station	NJ	0
White Meadow Lake	NJ	8836
Whitehouse Station	NJ	2089
Whitesboro	NJ	2205
Whitesboro-Burleigh	NJ	2205
Whittingham	NJ	2476
Wildwood	NJ	5149
Wildwood Crest	NJ	3182
William Paterson University of New Jersey	NJ	0
Williamstown	NJ	15567
Willingboro	NJ	31668
Windsor	NJ	0
Winfield	NJ	1514
Wood-Lynne	NJ	2978
Wood-Ridge	NJ	8249
Woodbine	NJ	2482
Woodbridge	NJ	19265
Woodbury	NJ	10020
Woodbury Heights	NJ	3010
Woodcliff Lake	NJ	5917
Woodland Park	NJ	12518
Woodlynne	NJ	0
Woodstown	NJ	3524
Wrightstown	NJ	796
Wyckoff	NJ	17124
Yardville	NJ	7186
Yorketown	NJ	6535
Zarephath	NJ	37
Abeytas	NM	56
Abiquiu	NM	231
Acomita Lake	NM	416
Adelino	NM	823
Agua Fria	NM	2800
Alamillo	NM	102
Alamo	NM	1085
Alamogordo	NM	30753
Albuquerque	NM	564559
Alcalde	NM	285
Algodones	NM	814
Alma	NM	0
Angel Fire	NM	1122
Angustura	NM	0
Animas	NM	237
Anthony	NM	9293
Anton Chico	NM	188
Anzac	NM	0
Anzac Village	NM	54
Apache Creek	NM	67
Aragon	NM	94
Arenas Valley	NM	1522
Arrey	NM	232
Arroyo Hondo	NM	474
Arroyo Seco	NM	1785
Artesia	NM	12036
Atoka	NM	1077
Aztec	NM	6147
Barton	NM	0
Bayard	NM	2264
Becenti	NM	0
Beclabito	NM	317
Belen	NM	7152
Bent	NM	119
Berino	NM	1441
Bernalillo	NM	8843
Bibo	NM	140
Black Hat	NM	0
Black Rock	NM	1323
Blanco	NM	388
Bloomfield	NM	7314
Bluewater	NM	0
Bluewater Acres	NM	206
Bluewater Village	NM	628
Boles Acres	NM	1638
Borrego Pass	NM	0
Bosque Farms	NM	3838
Brazos	NM	44
Brimhall Nizhoni	NM	199
Broadview	NM	0
Buckhorn	NM	200
Butterfield Park	NM	0
CaÃ±ada de los Alamos	NM	0
CaÃ±on	NM	0
CaÃ±oncito	NM	0
CaÃ±ones	NM	0
Caballo	NM	112
Cañada de los Alamos	NM	434
Candy Kitchen	NM	0
Canjilon	NM	256
Cannon AFB	NM	0
Cannon Air Force Base	NM	2245
Cañon	NM	327
Cañones	NM	118
Canova	NM	118
Capitan	NM	1392
Capulin	NM	286
Carlsbad	NM	28957
Carnuel	NM	1232
Carrizozo	NM	941
Casa Colorada	NM	272
Casas Adobes	NM	0
Catalpa Canyon	NM	0
Causey	NM	98
Cedar Crest	NM	958
Cedar Grove	NM	747
Cedar Hill	NM	847
Cedro	NM	430
Center Point	NM	0
Cerrillos	NM	241
Chama	NM	1004
Chamberino	NM	919
Chamisal	NM	310
Chamita	NM	870
Chamizal	NM	101
Chaparral	NM	14631
Chical	NM	107
Chili	NM	654
Chilili	NM	137
Chimayo	NM	3177
Chupadero	NM	362
Church Rock	NM	1128
Cimarron	NM	912
City of the Sun	NM	31
Clayton	NM	2774
Cliff	NM	293
Cloudcroft	NM	682
Clovis	NM	39480
Cobre	NM	39
Cochiti	NM	528
Cochiti Lake	NM	569
Columbus	NM	1625
Conchas Dam	NM	0
Conejo	NM	0
Continental Divide	NM	0
Cordova	NM	414
Corona	NM	162
Corrales	NM	8502
Costilla	NM	205
Cotton	NM	0
Cotton City	NM	388
Coyote	NM	128
Crestview	NM	0
Crouch Mesa	NM	0
Crownpoint	NM	2278
Cruzville	NM	72
Crystal	NM	311
Cuartelez	NM	469
Cuba	NM	736
Cubero	NM	289
Cundiyo	NM	72
Cuyamungue	NM	479
Cuyamungue Grant	NM	0
Datil	NM	54
Deer Canyon	NM	0
Deming	NM	14522
Des Moines	NM	129
Dexter	NM	1272
Dixon	NM	926
DoÃ±a Ana	NM	0
Doña Ana	NM	1211
Dora	NM	125
Dulce	NM	2743
Duran	NM	35
Eagle Nest	NM	295
East Pecos	NM	757
Edgewood	NM	3805
Edith Enclave	NM	0
Edith Endave	NM	211
El Cerro	NM	2953
El Cerro Mission	NM	4657
El Duende	NM	707
El Morro Valley	NM	0
El Rancho	NM	1199
El Rito	NM	808
El Valle de Arroyo Seco	NM	1440
Eldorado at Santa Fe	NM	6130
Elephant Butte	NM	1431
Elida	NM	186
Encantado	NM	0
Enchanted Hills	NM	87521
Encinal	NM	210
Encino	NM	78
Ensenada	NM	107
Escondida	NM	47
Escudilla Bonita	NM	119
EspaÃ±ola	NM	0
Española	NM	10224
Estancia	NM	1597
Eunice	NM	3136
Fairacres	NM	824
Farmington	NM	42871
Faywood	NM	0
Fence Lake	NM	42
Flora Vista	NM	2191
Floyd	NM	114
Folsom	NM	54
Fort Sumner	NM	932
Fort Wingate	NM	0
Fruitland	NM	0
Galisteo	NM	253
Gallina	NM	286
Gallup	NM	23240
Gamerco	NM	0
Garfield	NM	137
Gila	NM	314
Gila Hot Springs	NM	0
Glen Acres	NM	208
Glenwood	NM	143
Glorieta	NM	430
Golden	NM	37
Golden Acres	NM	0
Grady	NM	106
Grants	NM	9239
Grenville	NM	35
Hachita	NM	49
Hagerman	NM	1254
Hanover	NM	167
Happy Valley	NM	0
Hatch	NM	1600
Haystack	NM	0
Hernandez	NM	946
High Rolls	NM	834
Highland Meadows	NM	624
Hillsboro	NM	124
Hobbs	NM	38416
Holloman AFB	NM	0
Holloman Air Force Base	NM	3054
Homer C Jones	NM	0
Homestead	NM	0
Hope	NM	107
Hot Springs Landing	NM	110
House	NM	64
Huerfano	NM	109
Hurley	NM	1256
Hyde Park	NM	0
Indian Hills	NM	892
Isleta	NM	0
Isleta Village Proper	NM	491
Iyanbito	NM	0
Jacona	NM	412
Jaconita	NM	332
Jal	NM	2201
Jamestown	NM	0
Jarales	NM	2475
Jemez Pueblo	NM	1788
Jemez Springs	NM	253
Keeler Farm	NM	1305
Kingston	NM	32
Kirtland	NM	7875
Kirtland AFB	NM	0
La Bajada	NM	0
La Boca	NM	0
La Cienega	NM	3819
La Cueva	NM	168
La Hacienda	NM	725
La Huerta	NM	1246
La Jara	NM	207
La Joya	NM	82
La Luz	NM	1697
La Madera	NM	0
La Mesa	NM	728
La Mesilla	NM	1772
La Plata	NM	612
La Puebla	NM	1186
La Tierra	NM	0
La Union	NM	1106
La Villita	NM	957
Laguna	NM	1241
Lake Arthur	NM	437
Lake Roberts	NM	0
Lake Roberts Heights	NM	32
Lake Sumner	NM	143
Lake Valley	NM	64
LaMadera	NM	154
Lamy	NM	218
Las Campanas	NM	0
Las Cruces	NM	101643
Las Maravillas	NM	1628
Las Nutrias	NM	149
Las Palomas	NM	173
Las Tusas	NM	0
Las Vegas	NM	13386
Lee Acres	NM	5858
Lemitar	NM	330
Lindrith	NM	0
Little Walnut	NM	0
Livingston Wheeler	NM	609
Llano Del Medio	NM	118
Lobo Canyon	NM	0
Loco Hills	NM	126
Logan	NM	966
Lordsburg	NM	2531
Los Alamos	NM	12019
Los Cerrillos	NM	321
Los Chaves	NM	0
Los Chavez	NM	5446
Los Luceros	NM	906
Los Lunas	NM	15336
Los Ojos	NM	125
Los Ranchos de Albuquerque	NM	6063
Loving	NM	1409
Lovington	NM	11800
Lower Frisco	NM	31
Luis Lopez	NM	107
Lumberton	NM	73
Luna	NM	158
Lybrook	NM	0
Lyden	NM	245
Madrid	NM	204
Madrone	NM	707
Magdalena	NM	911
Malaga	NM	147
Manuelito	NM	0
Manzano	NM	29
Manzano Springs	NM	137
Maxwell	NM	228
Mayhill	NM	75
McCartys	NM	0
McCartys Village	NM	48
McGaffey	NM	0
McIntosh	NM	1484
Meadow Lake	NM	4708
Medanales	NM	0
Melrose	NM	644
Mescalero	NM	1338
Mesilla	NM	1874
Mesita	NM	804
Mesquite	NM	1112
Middle Frisco	NM	77
Middle Mesa	NM	0
Midway	NM	971
Milan	NM	3250
Mimbres	NM	667
Mogollon	NM	0
Monterey Park	NM	1567
Monument	NM	206
Moquino	NM	37
Mora	NM	656
Moriarty	NM	1806
Morningside	NM	367
Mosquero	NM	93
Mount Taylor	NM	0
Mountain View	NM	122
Mountainair	NM	878
Nadine	NM	376
Nageezi	NM	286
Nakaibito	NM	466
Nambe	NM	1818
Napi Headquarters	NM	727
Nara Visa	NM	95
Naschitti	NM	301
Navajo	NM	2087
Navajo Dam	NM	281
Nenahnezad	NM	688
Newcomb	NM	339
Newkirk	NM	7
Nogal	NM	96
North Acomita	NM	0
North Acomita Village	NM	303
North Hobbs	NM	0
North Hurley	NM	300
North Light Plant	NM	414
North San Ysidro	NM	159
North Valley	NM	11333
Oasis	NM	149
Ohkay Owingeh	NM	1143
Ojo Amarillo	NM	696
Ojo Caliente	NM	0
Ojo Encino	NM	222
Ojo Sarco	NM	0
Old	NM	0
Organ	NM	323
Orogrande	NM	52
Paa-Ko	NM	0
Paguate	NM	421
Pajarito Mesa	NM	579
Paradise Hills	NM	4256
Paraje	NM	777
Pastura	NM	23
PeÃ±a Blanca	NM	0
PeÃ±asco	NM	0
Peak Place	NM	377
Pecan Park	NM	75
Pecos	NM	1324
Peña Blanca	NM	709
Peñasco	NM	589
Peralta	NM	3585
Picacho Hills	NM	0
Picuris Pueblo	NM	68
Pie	NM	0
Pie Town	NM	186
Pinedale	NM	0
Pinehaven	NM	0
Pinehill	NM	88
Piñon	NM	25
Pinos Altos	NM	198
Placitas	NM	4977
Playas	NM	74
Pleasanton	NM	106
Pojoaque	NM	1907
Polvadera	NM	269
Ponderosa	NM	387
Ponderosa Pine	NM	1195
Portales	NM	11995
Prewitt	NM	0
Pueblito	NM	91
Pueblitos	NM	794
Pueblo	NM	0
Pueblo of Sandia	NM	0
Pueblo of Sandia Village	NM	369
Pueblo Pintado	NM	192
Puerto De Luna	NM	141
Pulpotio Bareas	NM	120
Punta de Agua	NM	0
Purty Rock	NM	0
Quemado	NM	228
Questa	NM	1753
Radium Springs	NM	1699
Ramah	NM	370
Rancho Grande	NM	0
Ranchos de Taos	NM	2518
Raton	NM	6187
Red River	NM	476
Red Rock Ranch	NM	0
Redrock	NM	0
Regina	NM	105
Reserve	NM	272
Ribera	NM	416
Rincon	NM	271
Rio Chiquito	NM	108
Rio Communities	NM	4723
Rio En Medio	NM	143
Rio Lucio	NM	389
Rio Rancho	NM	87521
Rio Rancho Estates	NM	0
Rivers	NM	28
Rock Springs	NM	567
Rodeo	NM	101
Rodey	NM	388
Rosedale	NM	394
Roswell	NM	48544
Rowe	NM	415
Roy	NM	235
Ruidoso	NM	7739
Ruidoso Downs	NM	2586
Sacramento	NM	58
Sagar	NM	0
Salem	NM	942
San Acacia	NM	44
San Antonio	NM	165
San Antonito	NM	985
San Cristobal	NM	273
San Felipe Pueblo	NM	2404
San Fidel	NM	138
San Ildefonso Pueblo	NM	524
San Jon	NM	203
San Jose	NM	695
San Juan	NM	592
San Lorenzo	NM	97
San Luis	NM	59
San Mateo	NM	161
San Miguel	NM	1153
San Pablo	NM	806
San Pedro	NM	184
San Rafael	NM	933
San Ysidro	NM	2090
Sandia Heights	NM	3193
Sandia Knolls	NM	1208
Sandia Park	NM	237
Sanostee	NM	371
Santa Ana Pueblo	NM	610
Santa Clara	NM	1638
Santa Clara Pueblo	NM	1018
Santa Cruz	NM	368
Santa Fe	NM	87505
Santa Fe Foothills	NM	0
Santa Rosa	NM	2675
Santa Teresa	NM	4258
Santo Domingo Pueblo	NM	2456
Sausal	NM	0
Seama	NM	465
Seboyeta	NM	179
Sedillo	NM	802
Sena	NM	129
Seton	NM	0
Sheep Springs	NM	245
Shiprock	NM	8295
Silver	NM	0
Silver City	NM	10004
Skyline-Ganipa	NM	1224
Socorro	NM	8722
Soham	NM	210
Sombrillo	NM	351
South Acomita	NM	0
South Acomita Village	NM	105
South River	NM	0
South Valley	NM	40976
Spencerville	NM	1258
Springer	NM	943
Stanley	NM	0
Stoneridge	NM	0
Sullivan	NM	0
Sundance	NM	0
Sunland Park	NM	15940
Sunlit Hills	NM	0
Sunshine	NM	420
Tajique	NM	130
Talpa	NM	778
Tano Road	NM	0
Taos	NM	5740
Taos Pueblo	NM	1135
Taos Ski Valley	NM	69
Tatum	NM	857
Tecolote	NM	298
Tecolotito	NM	232
Tesuque	NM	925
Tesuque Pueblo	NM	233
Texico	NM	1119
Thoreau	NM	1865
Thunder Mountain	NM	0
Tierra Amarilla	NM	382
Tijeras	NM	541
Timberlake	NM	0
Timberon	NM	348
Tohatchi	NM	808
Tome	NM	1867
Torreon	NM	326
Tortugas	NM	0
Totah Vista	NM	0
Tres Arroyos	NM	0
Trout Valley	NM	16
Truchas	NM	560
Truth or Consequences	NM	6079
Tse Bonito	NM	299
Tucumcari	NM	5025
Tularosa	NM	2864
Turley	NM	0
Twin Forks	NM	196
Twin Lakes	NM	1052
Tyrone	NM	637
University Park	NM	4192
Upper Fruitland	NM	1662
Ute Park	NM	71
Vadito	NM	270
Vado	NM	3194
Valencia	NM	2192
Valle Vista	NM	0
Vanderwagen	NM	0
Vaughn	NM	413
Veguita	NM	232
Velarde	NM	502
Ventura	NM	468
Villanueva	NM	229
Virden	NM	137
Wagon Mound	NM	297
Waterflow	NM	1670
Watrous	NM	135
Weed	NM	63
West Hammond	NM	2790
White Cliffs	NM	0
White Rock	NM	5725
White Sands	NM	1651
White Signal	NM	181
Whites	NM	0
Whites City	NM	7
Willard	NM	241
Williams Acres	NM	0
Williamsburg	NM	425
Windmill	NM	43
Winston	NM	61
Yah-ta-hey	NM	590
Young Place	NM	187
Youngsville	NM	56
Zia Pueblo	NM	737
Zuni Pueblo	NM	6302
Alamo	NV	1080
Amargosa Valley	NV	0
Austin	NV	192
Baker	NV	68
Battle Mountain	NV	3635
Beatty	NV	1010
Beaverdam	NV	44
Bennett Springs	NV	0
Black Rock City	NV	10
Blue Diamond	NV	290
Boulder	NV	0
Boulder City	NV	15551
Bunkerville	NV	1303
Burning Man Earth	NV	10
Cal-Nev-Ari	NV	244
Caliente	NV	1109
Carlin	NV	2302
Carson	NV	0
Carson City	NV	58639
Carter Springs	NV	553
Cold Springs	NV	8544
Crescent Valley	NV	392
Crystal Bay	NV	305
Dayton	NV	8964
Denio	NV	47
Double Spring	NV	0
Dry Valley	NV	0
Dyer	NV	259
East Valley	NV	1474
Elko	NV	20279
Ely	NV	4134
Empire	NV	217
Enterprise	NV	108481
Eureka	NV	610
Fallon	NV	8458
Fallon Station	NV	705
Fernley	NV	19418
Fish Springs	NV	648
Fort McDermitt	NV	0
Gabbs	NV	269
Gardnerville	NV	5656
Gardnerville Ranchos	NV	11312
Genoa	NV	939
Gerlach	NV	206
Glenbrook	NV	215
Golconda	NV	214
Golden Valley	NV	1556
Goldfield	NV	268
Goodsprings	NV	229
Grass Valley	NV	0
Hawthorne	NV	3269
Henderson	NV	285667
Hiko	NV	119
Humboldt	NV	119
Humboldt River Ranch	NV	0
Imlay	NV	171
Incline	NV	0
Incline Village	NV	8777
Indian Hills	NV	5627
Indian Springs	NV	991
Jackpot	NV	1195
Johnson Lane	NV	6490
Kingsbury	NV	2152
Kingston	NV	113
Lakeridge	NV	371
Lamoille	NV	105
Las Vegas	NV	641903
Laughlin	NV	7323
Lemmon Valley	NV	5040
Logan Creek	NV	0
Lovelock	NV	1878
Lund	NV	282
McDermitt	NV	172
McGill	NV	1148
Mesquite	NV	17496
Mina	NV	155
Minden	NV	3001
Moapa	NV	0
Moapa Town	NV	1025
Moapa Valley	NV	6924
Mogul	NV	1290
Montello	NV	84
Mount Charleston	NV	357
Mount Wilson	NV	0
Mountain	NV	0
Nellis AFB	NV	0
Nellis Air Force Base	NV	3187
Nelson	NV	37
Nixon	NV	374
North Las Vegas	NV	234807
Oasis	NV	29
Orovada	NV	155
Osino	NV	709
Owyhee	NV	953
Pahrump	NV	36441
Panaca	NV	963
Paradise	NV	223167
Paradise Valley	NV	109
Pioche	NV	1002
Preston	NV	78
Rachel	NV	54
Reno	NV	264165
Round Hill	NV	0
Ruhenstroth	NV	0
Ruth	NV	440
Sandy Valley	NV	2051
Schurz	NV	658
Searchlight	NV	539
Silver	NV	0
Silver Peak	NV	107
Silver Springs	NV	5296
Skyland	NV	376
Smith	NV	1033
Smith Valley	NV	1603
Spanish Springs	NV	15064
Sparks	NV	96094
Spring Creek	NV	12361
Spring Valley	NV	178395
Stagecoach	NV	1874
Stateline	NV	842
Summerlin South	NV	24085
Sun Valley	NV	19299
Sunrise Manor	NV	189372
Sutcliffe	NV	253
Tonopah	NV	2478
Topaz Lake	NV	157
Topaz Ranch Estates	NV	1501
Unionville	NV	0
Ursine	NV	91
Valmy	NV	37
Verdi	NV	1415
Virginia	NV	0
Virginia City	NV	855
Wadsworth	NV	834
Walker Lake	NV	275
Washoe Valley	NV	0
Wells	NV	1261
West Wendover	NV	4294
Whitney	NV	38585
Winchester	NV	27978
Winnemucca	NV	7887
Yerington	NV	3064
Zephyr Cove	NV	565
Accord	NY	562
Adams	NY	1829
Adams Center	NY	1568
Addison	NY	1716
Afton	NY	810
Airmont	NY	8891
Akron	NY	2845
Akwesasne	NY	0
Alabama	NY	1818
Albany	NY	101228
Albertson	NY	5182
Albion	NY	5998
Alden	NY	2589
Alexander	NY	497
Alexandria Bay	NY	1097
Alfred	NY	4061
Allegany	NY	1738
Alma	NY	847
Almond	NY	446
Altamont	NY	1720
Altmar	NY	407
Altona	NY	730
Amagansett	NY	1165
Amenia	NY	955
Ames	NY	142
Amherst	NY	122366
Amityville	NY	9486
Amsterdam	NY	18008
Andes	NY	252
Andover	NY	1008
Angelica	NY	838
Angola	NY	2114
Angola on the Lake	NY	1675
Antwerp	NY	685
Apalachin	NY	1131
Aquebogue	NY	2438
Arcade	NY	1986
Ardsley	NY	4638
Argyle	NY	296
Arkport	NY	822
Arlington	NY	4061
Armonk	NY	4330
Arrochar	NY	13010
Arverne	NY	14120
Asharoken	NY	654
Astoria	NY	150165
Athens	NY	1617
Athol	NY	737
Atlantic Beach	NY	1914
Attica	NY	2470
Au Sable Forks	NY	559
Auburn	NY	26985
Augusta	NY	2041
Aurora	NY	718
Averill Park	NY	1693
Avoca	NY	922
Avon	NY	3319
Babylon	NY	12161
Bainbridge	NY	1325
Baiting Hollow	NY	1642
Baldwin	NY	24033
Baldwin Harbor	NY	8102
Baldwinsville	NY	7770
Ballston Lake	NY	9776
Ballston Spa	NY	5375
Balmville	NY	3178
Bard College	NY	0
Bardonia	NY	4108
Barker	NY	512
Barneveld	NY	282
Barnum Island	NY	2414
Barrytown	NY	250
Barryville	NY	1289
Batavia	NY	15010
Bath	NY	5635
Bath Beach	NY	33080
Battery Park City	NY	7422
Baxter Estates	NY	1012
Bay Park	NY	2212
Bay Shore	NY	26337
Bay Wood	NY	7350
Baychester	NY	16274
Bayport	NY	8896
Bayside	NY	66455
Bayville	NY	6764
Baywood	NY	0
Beacon	NY	14347
Beaver Dam Lake	NY	2242
Beaver Falls	NY	500
Beaverdam Lake-Salisbury Mills	NY	2242
Bedford	NY	1834
Bedford Hills	NY	3001
Belfast	NY	837
Bellaire	NY	5610
Belle Harbor	NY	6758
Belle Terre	NY	792
Bellerose	NY	1201
Bellerose Terrace	NY	2198
Belleville	NY	226
Bellmore	NY	16218
Bellport	NY	2078
Belmont	NY	939
Bemus Point	NY	356
Bensonhurst	NY	60000
Bergen	NY	1133
Bergen Beach	NY	13596
Berne	NY	2794
Bernhards Bay	NY	1350
Bethpage	NY	16429
Big Flats	NY	5277
Big Flats Airport	NY	7595
Billington Heights	NY	1685
Binghamton	NY	46032
Binghamton University	NY	0
Birchland Park	NY	472
Black River	NY	1332
Blasdell	NY	2592
Blauvelt	NY	5689
Bliss	NY	527
Blodgett Mills	NY	303
Bloomfield	NY	1248
Bloomingburg	NY	411
Bloomville	NY	213
Blossvale	NY	2816
Blue Point	NY	4773
Bohemia	NY	10180
Bolivar	NY	1138
Bolton Landing	NY	513
Boonville	NY	2040
Borough Park	NY	149248
Boston	NY	8049
Bowmansville	NY	641
Braman Corners	NY	1001
Branchport	NY	1376
Brasher Falls	NY	669
Breesport	NY	626
Brentwood	NY	60664
Brewerton	NY	4029
Brewster	NY	2332
Brewster Heights	NY	0
Brewster Hill	NY	2089
Briarcliff Manor	NY	8028
Briarwood	NY	53877
Bridgehampton	NY	1756
Bridgeport	NY	1490
Bridgeville	NY	0
Bridgewater	NY	470
Brighton	NY	36609
Brighton Beach	NY	31462
Brightwaters	NY	3088
Brinckerhoff	NY	2900
Broad Channel	NY	2443
Broadalbin	NY	1303
Brockport	NY	8357
Brocton	NY	1429
Bronxville	NY	6438
Brookhaven	NY	3451
Brooklyn	NY	2736074
Brooklyn Heights	NY	20256
Brooktondale	NY	0
Brookville	NY	3566
Brownsville	NY	74497
Brownville	NY	1156
Brushton	NY	445
Buchanan	NY	2268
Buffalo	NY	258071
Burdett	NY	326
Burke	NY	207
Burlington Flats	NY	0
Bushwick	NY	112620
Busti	NY	391
Byersville	NY	47
Byron	NY	2369
Cadyville	NY	0
Cairo	NY	1402
Calcium	NY	3491
Caledonia	NY	2146
Callicoon	NY	167
Calverton	NY	6510
Cambria Heights	NY	20287
Cambridge	NY	1830
Camden	NY	2202
Camillus	NY	1228
Campbell	NY	713
Canajoharie	NY	2163
Canandaigua	NY	10431
Canarsie	NY	87366
Canaseraga	NY	524
Canastota	NY	4661
Candor	NY	815
Canisteo	NY	2204
Canton	NY	6570
Cape Vincent	NY	741
Captree	NY	0
Carle Place	NY	4981
Carmel	NY	4800
Carmel Hamlet	NY	6817
Caroga Lake	NY	518
Carthage	NY	3591
Cassadaga	NY	611
Cassville	NY	1279
Castile	NY	986
Castleton-on-Hudson	NY	1473
Castorland	NY	348
Cato	NY	521
Catskill	NY	3874
Cattaraugus	NY	937
Cayuga	NY	527
Cayuga Heights	NY	3822
Cazenovia	NY	2855
Cedarhurst	NY	6682
Celoron	NY	1070
Cementon	NY	0
Center Moriches	NY	7580
Centereach	NY	31578
Centerport	NY	5508
Central Bridge	NY	593
Central Islip	NY	34450
Central Square	NY	1813
Central Valley	NY	1810
Centre Island	NY	409
Chadwicks	NY	1506
Champlain	NY	1074
Chappaqua	NY	1436
Charleston	NY	1567
Chateaugay	NY	820
Chatham	NY	1696
Chaumont	NY	616
Chautauqua	NY	191
Chazy	NY	565
Cheektowaga	NY	75178
Chelsea	NY	2953
Chelsea Cove	NY	0
Chenango Bridge	NY	2883
Cherry Creek	NY	440
Cherry Grove	NY	195
Cherry Valley	NY	503
Chester	NY	3918
Chestertown	NY	677
Chestnut Ridge	NY	8158
Chinatown	NY	90000
Chittenango	NY	4891
Churchville	NY	2032
Cicero	NY	31632
Cincinnatus	NY	1056
City Island	NY	4362
Clarence	NY	2646
Clarence Center	NY	2257
Clark Mills	NY	1905
Clarkson	NY	4358
Claverack-Red Mills	NY	913
Clay	NY	58206
Clayton	NY	1956
Clayville	NY	341
Cleveland	NY	738
Clifton	NY	9519
Clifton Gardens	NY	0
Clifton Knolls-Mill Creek	NY	0
Clifton Park	NY	36705
Clifton Springs	NY	2092
Clinton	NY	1891
Clinton Corners	NY	3168
Clintondale	NY	1452
Clyde	NY	2006
Clymer	NY	1698
Cobleskill	NY	4566
Coeymans	NY	848
Cohocton	NY	817
Cohoes	NY	16538
Cold Brook	NY	322
Cold Spring	NY	1964
Cold Spring Harbor	NY	5070
College Point	NY	27307
Colonie	NY	7906
Colton	NY	345
Columbus	NY	947
Commack	NY	36124
Concord	NY	8857
Conesus	NY	0
Conesus Hamlet	NY	308
Conesus Lake	NY	0
Coney Island	NY	60000
Congers	NY	8363
Conklin	NY	5008
Constableville	NY	240
Constantia	NY	1182
Coopers Plains	NY	598
Cooperstown	NY	1792
Copake	NY	0
Copake Falls	NY	0
Copake Lake	NY	823
Copenhagen	NY	800
Copiague	NY	22993
Coram	NY	39113
Corfu	NY	695
Corinth	NY	2516
Corning	NY	10897
Cornwall	NY	2966
Cornwall-on-Hudson	NY	0
Corona	NY	109698
Cortland	NY	18907
Cortland West	NY	1356
Cortlandt Manor	NY	19929
Country Knolls	NY	2224
Cove Neck	NY	300
Coxsackie	NY	2701
Cragsmoor	NY	449
Cranberry Lake	NY	200
Crest View Heights	NY	0
Croghan	NY	610
Crompond	NY	2292
Cropseyville	NY	1713
Croton-on-Hudson	NY	8269
Crown Heights	NY	2840
Crown Point	NY	1903
Crugers	NY	1534
Crystal Beach	NY	644
Cuba	NY	1529
Cumberland Head	NY	1627
Cumminsville	NY	183
Cutchogue	NY	3349
Cuylerville	NY	297
Cypress Hills	NY	54944
Dalton	NY	362
Danby	NY	0
Dannemora	NY	3629
Dansville	NY	4550
Davenport Center	NY	349
Davis Park	NY	717
De Kalb Junction	NY	519
De Witt	NY	0
Deansboro	NY	1500
Deer Park	NY	27745
Deferiet	NY	292
DeKalb Junction	NY	0
Delanson	NY	379
Delevan	NY	1058
Delhi	NY	3157
Delmar	NY	8195
Depauville	NY	577
Depew	NY	15146
Deposit	NY	1598
Dering Harbor	NY	11
DeRuyter	NY	535
Dexter	NY	1086
Dix Hills	NY	26892
Dobbs Ferry	NY	11131
Dolgeville	NY	2132
Dongan Hills	NY	9529
Douglaston	NY	14762
Dover Plains	NY	1323
Downsville	NY	617
Downtown Brooklyn	NY	7053
Dresden	NY	300
Dryden	NY	2094
Duane Lake	NY	323
Duanesburg	NY	391
Dundee	NY	1665
Dunkirk	NY	12081
Durham	NY	2670
Durhamville	NY	584
Dyker Heights	NY	34399
Eagle Bay	NY	0
Earlville	NY	830
East Amherst	NY	24914
East Atlantic Beach	NY	2049
East Aurora	NY	6236
East Avon	NY	608
East Durham	NY	0
East Elmhurst	NY	23150
East Farmingdale	NY	6484
East Flatbush	NY	178464
East Frankfort	NY	0
East Garden City	NY	6208
East Glenville	NY	6616
East Greenbush	NY	4487
East Hampton	NY	1122
East Hampton North	NY	4142
East Harlem	NY	115921
East Herkimer	NY	0
East Hills	NY	7155
East Islip	NY	14475
East Ithaca	NY	2231
East Kingston	NY	276
East Marion	NY	926
East Massapequa	NY	19069
East Meadow	NY	38132
East Moriches	NY	5249
East Nassau	NY	570
East New York	NY	173198
East Northport	NY	20217
East Norwich	NY	2709
East Patchogue	NY	22469
East Quogue	NY	4757
East Randolph	NY	620
East Rochester	NY	6666
East Rockaway	NY	9894
East Setauket	NY	17006
East Shoreham	NY	6666
East Syracuse	NY	3010
East Tremont	NY	22886
East Village	NY	62832
East Williston	NY	2578
East Worcester	NY	0
Eastchester	NY	19554
Eastport	NY	1831
Eatons Neck	NY	1406
Eden	NY	3806
Edgemere	NY	9646
Edinburg	NY	1220
Edmeston	NY	657
Edwards	NY	439
Eggertsville	NY	15019
Elba	NY	663
Elbridge	NY	1035
Eldred	NY	0
Elizabethtown	NY	754
Ellenville	NY	4081
Ellicottville	NY	388
Ellisburg	NY	247
Elma Center	NY	2571
Elmhurst	NY	113364
Elmira	NY	28213
Elmira Heights	NY	3982
Elmont	NY	33198
Elmsford	NY	4810
Eltingville	NY	10573
Elwood	NY	11177
Emerson Hill	NY	15412
Endicott	NY	13014
Endwell	NY	11446
Erin	NY	483
Esperance	NY	331
Evans Mills	NY	598
Fabius	NY	348
Fair Haven	NY	864
Fairmount	NY	10224
Fairport	NY	5351
Fairview	NY	5515
Falconer	NY	2321
Fallsburg	NY	12773
Far Rockaway	NY	39189
Farmingdale	NY	8688
Farmingville	NY	15481
Farnham	NY	369
Fayetteville	NY	4180
Felts Mills	NY	372
Fillmore	NY	603
Financial District	NY	60976
Fire Island	NY	292
Firthcliffe	NY	4949
Fishers Island	NY	236
Fishers Landing	NY	89
Fishkill	NY	2133
Flanders	NY	4472
Flatbush	NY	93361
Flatlands	NY	63601
Fleischmanns	NY	329
Floral Park	NY	15969
Florida	NY	2899
Flower Hill	NY	4838
Fly Creek	NY	0
Fonda	NY	765
Fordham	NY	94678
Forest Hills	NY	67714
Forest Home	NY	572
Forestville	NY	669
Fort Ann	NY	476
Fort Covington	NY	0
Fort Covington Hamlet	NY	1308
Fort Drum	NY	12955
Fort Edward	NY	3277
Fort Hamilton	NY	28966
Fort Johnson	NY	469
Fort Montgomery	NY	1571
Fort Plain	NY	2248
Fort Salonga	NY	10008
Fort Wadsworth	NY	1669
Fowlerville	NY	227
Frankfort	NY	2507
Franklin	NY	350
Franklin Square	NY	29320
Franklinville	NY	1681
Fredonia	NY	10705
Freedom Plains	NY	421
Freeport	NY	43334
Freeville	NY	520
Fresh Meadows	NY	28397
Frewsburg	NY	1906
Friendship	NY	1218
Fulton	NY	11552
Fultonville	NY	788
Gainesville	NY	222
Galeville	NY	4617
Galway	NY	199
Gananda	NY	0
Gang Mills	NY	4185
Garden	NY	0
Garden City	NY	22612
Garden City Park	NY	7806
Garden City South	NY	4024
Gardiner	NY	950
Gardnertown	NY	4373
Garrattsville	NY	0
Gasport	NY	1248
Gates	NY	0
Gates-North Gates	NY	15138
Geneseo	NY	8173
Geneva	NY	13062
Georgetown	NY	974
Germantown	NY	845
Ghent	NY	564
Gilbertsville	NY	379
Gilgo	NY	0
Gilgo-Oak Beach-Captree	NY	286
Glasco	NY	2099
Glen Aubrey	NY	485
Glen Cove	NY	27400
Glen Head	NY	4697
Glen Oaks	NY	6655
Glen Park	NY	508
Glendale	NY	34389
Glens Falls	NY	14291
Glens Falls North	NY	8443
Glenville	NY	29326
Glenwood Landing	NY	3779
Gloversville	NY	15023
Golden's Bridge	NY	0
Goldens Bridge	NY	1630
Gordon Heights	NY	4042
Gorham	NY	617
Goshen	NY	5397
Gouverneur	NY	3797
Gowanda	NY	2636
Grahamsville	NY	0
Gramercy Park	NY	27988
Grand Island	NY	20813
Grand View-on-Hudson	NY	285
Grandyle	NY	0
Grandyle Village	NY	4629
Graniteville	NY	15272
Grant City	NY	4594
Granville	NY	2467
Gravesend	NY	112229
Great Bend	NY	843
Great Kills	NY	22000
Great Neck	NY	10143
Great Neck Estates	NY	2827
Great Neck Gardens	NY	1186
Great Neck Plaza	NY	6925
Great River	NY	1489
Greece	NY	14519
Green Island	NY	2612
Greenburgh	NY	86764
Greene	NY	1502
Greenlawn	NY	13742
Greenpoint	NY	34719
Greenport	NY	2212
Greenport West	NY	2124
Greenridge	NY	261
Greenvale	NY	1094
Greenville	NY	7116
Greenwich	NY	1744
Greenwood Lake	NY	3113
Greigsville	NY	209
Groton	NY	2396
Groveland Station	NY	281
Grymes Hill	NY	4985
Guilford	NY	362
Hadley	NY	1009
Hagaman	NY	1299
Hailesboro	NY	624
Haines Falls	NY	0
Halesite	NY	2498
Hall	NY	216
Hamburg	NY	9576
Hamilton	NY	4176
Hamilton Beach	NY	66
Hamilton College	NY	0
Hamlin	NY	5521
Hammond	NY	275
Hammondsport	NY	644
Hampton	NY	938
Hampton Bays	NY	13603
Hampton Manor	NY	2417
Hancock	NY	976
Hankins	NY	0
Hannawa Falls	NY	1042
Hannibal	NY	534
Harbor Hills	NY	575
Harbor Isle	NY	1301
Harlem	NY	116345
Harriman	NY	2476
Harris Hill	NY	5508
Harrison	NY	28348
Harrisville	NY	622
Hartford	NY	2240
Hartsdale	NY	5293
Hartwick	NY	629
Hartwick Seminary	NY	0
Hastings-on-Hudson	NY	8014
Hauppauge	NY	20882
Haverstraw	NY	12187
Haviland	NY	3634
Hawthorne	NY	4586
Head of the Harbor	NY	1477
Hell's Kitchen	NY	45884
Hemlock	NY	557
Hempstead	NY	55547
Henderson	NY	224
Henrietta	NY	42581
Heritage Hills	NY	3975
Herkimer	NY	7519
Hermon	NY	406
Herricks	NY	4295
Herrings	NY	89
Heuvelton	NY	729
Hewlett	NY	6819
Hewlett Bay Park	NY	432
Hewlett Harbor	NY	1274
Hewlett Neck	NY	474
Hicksville	NY	41547
High Falls	NY	627
Highland	NY	5647
Highland Falls	NY	3841
Highland Mills	NY	3957
Highland-on-the-Lake	NY	0
Hillburn	NY	982
Hillcrest	NY	7558
Hillside	NY	24808
Hillside Lake	NY	1084
Hilton	NY	5921
Hobart	NY	414
Holbrook	NY	27195
Holcomb	NY	1361
Holland	NY	1206
Holland Patent	NY	455
Holley	NY	1735
Hollis	NY	20269
Holtsville	NY	19714
Homer	NY	3183
Honeoye	NY	579
Honeoye Falls	NY	2711
Hoosick Falls	NY	3432
Hopewell Junction	NY	376
Hornell	NY	8336
Horseheads	NY	6616
Horseheads North	NY	2843
Hortonville	NY	218
Houghton	NY	1693
Howard Beach	NY	26148
Hudson	NY	6436
Hudson Falls	NY	7191
Huguenot	NY	9995
Hunt	NY	78
Hunter	NY	484
Huntington	NY	18046
Huntington Bay	NY	1430
Huntington Station	NY	33029
Hunts Point	NY	27204
Hurley	NY	3458
Hurleyville	NY	0
Hyde Park	NY	1908
Ilion	NY	7926
Inlet	NY	324
Interlaken	NY	623
Inwood	NY	10082
Ira	NY	2145
Irondequoit	NY	51692
Irvington	NY	6607
Island Park	NY	4766
Islandia	NY	3382
Islip	NY	18689
Islip Terrace	NY	5389
Ithaca	NY	30788
Jackson Heights	NY	67067
Jacksonville	NY	0
Jamaica	NY	216866
Jamesport	NY	1710
Jamestown	NY	30075
Jamestown West	NY	2408
Jefferson	NY	0
Jefferson Heights	NY	1094
Jefferson Valley-Yorktown	NY	14142
Jeffersonville	NY	338
Jericho	NY	13567
Johnson	NY	0
Johnson City	NY	14773
Johnstown	NY	8345
Jordan	NY	1333
Kaser	NY	5131
Katonah	NY	1679
Kauneonga Lake	NY	0
Keeseville	NY	1750
Kenmore	NY	15160
Kennedy	NY	465
Kensington	NY	39120
Kerhonkson	NY	1684
Keuka Park	NY	1137
Kew Gardens	NY	18983
Kew Gardens Hills	NY	37479
Kiamesha Lake	NY	0
Kiantone	NY	1332
Kinderhook	NY	1182
Kings Bridge	NY	75132
Kings Park	NY	17282
Kings Point	NY	5131
Kingston	NY	23436
Kirkville	NY	4685
Kiryas Joel	NY	32954
Kysorville	NY	110
La Fargeville	NY	608
Lackawanna	NY	17965
Lacona	NY	562
Lake Carmel	NY	8282
Lake Delta	NY	0
Lake Erie Beach	NY	3872
Lake George	NY	890
Lake Grove	NY	11235
Lake Huntington	NY	0
Lake Katrine	NY	2397
Lake Luzerne	NY	1227
Lake Mohegan	NY	6010
Lake Placid	NY	2465
Lake Pleasant	NY	762
Lake Ronkonkoma	NY	20155
Lake Success	NY	3050
Lakeland	NY	2786
Lakeview	NY	5625
Lakeville	NY	756
Lakewood	NY	2914
Lancaster	NY	10258
Lansing	NY	3649
Larchmont	NY	6132
Latham	NY	20736
Lattingtown	NY	1787
Laurel	NY	1394
Laurel Hollow	NY	2036
Laurelton	NY	21053
Laurens	NY	258
Lawrence	NY	6559
Le Roy	NY	4288
Leeds	NY	377
Leicester	NY	455
Levittown	NY	51881
Lewiston	NY	2596
Liberty	NY	4134
Lido Beach	NY	2897
Lima	NY	2095
Lime Lake	NY	867
Limestone	NY	389
Lincoln Park	NY	2366
Lincolndale	NY	1521
Lindenhurst	NY	27277
Lindley	NY	1954
Linwood	NY	74
Lisle	NY	309
Little Falls	NY	4787
Little Neck	NY	10049
Little Valley	NY	1105
Liverpool	NY	2294
Livingston Manor	NY	1221
Livonia	NY	1351
Livonia Center	NY	421
Lloyd Harbor	NY	3690
Loch Sheldrake	NY	0
Lockport	NY	20624
Locust Valley	NY	3406
Lodi	NY	294
Long Beach	NY	33550
Long Island City	NY	25595
Long Lake	NY	547
Lorenz Park	NY	2053
Lorraine	NY	174
Loudonville	NY	0
Lowville	NY	3416
Lynbrook	NY	19558
Lyncourt	NY	4250
Lyndon	NY	683
Lyndonville	NY	803
Lyon Mountain	NY	423
Lyons	NY	3619
Lyons Falls	NY	565
MacDonnell Heights	NY	0
Macedon	NY	1479
Machias	NY	471
Madison	NY	298
Madrid	NY	757
Mahopac	NY	8369
Malden	NY	419
Malden-on-Hudson	NY	405
Malone	NY	5756
Malverne	NY	8571
Malverne Park Oaks	NY	505
Mamaroneck	NY	19375
Manchester	NY	1661
Manhasset	NY	8080
Manhasset Hills	NY	3592
Manhattan	NY	1487536
Manhattan Valley	NY	38500
Manlius	NY	4630
Mannsville	NY	361
Manorhaven	NY	6744
Manorville	NY	14314
Marathon	NY	889
Marbletown	NY	5544
Marcellus	NY	1773
Marcy	NY	0
Margaretville	NY	577
Mariaville Lake	NY	722
Mariners Harbor	NY	19905
Marion	NY	1511
Marist College	NY	0
Marlboro	NY	3669
Maspeth	NY	48325
Massapequa	NY	21685
Massapequa Park	NY	17232
Massena	NY	10629
Mastic	NY	15481
Mastic Beach	NY	14841
Matinecock	NY	810
Mattituck	NY	4219
Mattydale	NY	6446
Maybrook	NY	3286
Mayfield	NY	803
Mayville	NY	1669
McGraw	NY	1020
McKownville	NY	2756
McLean	NY	0
Mechanicstown	NY	6858
Mechanicville	NY	5169
Medford	NY	24142
Medina	NY	5827
Medusa	NY	382
Melrose	NY	22470
Melrose Park	NY	2294
Melville	NY	18985
Menands	NY	3998
Meridian	NY	303
Merrick	NY	22097
Merritt Park	NY	1256
Mexico	NY	1574
Middle Island	NY	10483
Middle Village	NY	29491
Middleburgh	NY	1437
Middleport	NY	1822
Middletown	NY	27812
Middleville	NY	501
Midland Beach	NY	7402
Milford	NY	401
Mill Neck	NY	1015
Millbrook	NY	1425
Miller Place	NY	12339
Millerton	NY	940
Millport	NY	296
Millwood	NY	0
Milton	NY	3087
Mineola	NY	19139
Minetto	NY	1069
Mineville	NY	1269
Minoa	NY	3523
Mohawk	NY	2628
Mongaup Valley	NY	0
Monroe	NY	8632
Monsey	NY	18412
Montauk	NY	3326
Montebello	NY	4652
Montgomery	NY	4609
Monticello	NY	6505
Montour Falls	NY	1676
Montrose	NY	2731
Mooers	NY	442
Moravia	NY	1236
Moriches	NY	2838
Morningside Heights	NY	55929
Morris	NY	564
Morris Heights	NY	40982
Morris Park	NY	10289
Morrisania	NY	23127
Morrisonville	NY	1545
Morristown	NY	387
Morrisville	NY	1764
Mott Haven	NY	51450
Mount Ivy	NY	6878
Mount Kisco	NY	11145
Mount Morris	NY	2899
Mount Sinai	NY	12118
Mount Vernon	NY	68628
Mount Vision	NY	0
Mountain Dale	NY	0
Mountain Lodge Park	NY	1588
Munnsville	NY	469
Munsey Park	NY	2715
Munsons Corners	NY	2728
Muttontown	NY	3670
Myers Corner	NY	6790
Nanuet	NY	17882
Napanoch	NY	1174
Napeague	NY	200
Naples	NY	1019
Narrowsburg	NY	431
Nassau	NY	1124
Nassau Lake	NY	0
Natural Bridge	NY	365
Nazareth College	NY	0
Nedrow	NY	2244
Nelliston	NY	575
Nelsonville	NY	625
Neponsit	NY	1355
Nesconset	NY	13387
New	NY	0
New Baltimore	NY	0
New Berlin	NY	974
New Brighton	NY	3421
New Cassel	NY	14059
New City	NY	33559
New Dorp	NY	7253
New Dorp Beach	NY	6201
New Hackensack	NY	0
New Hamburg	NY	0
New Hartford	NY	1844
New Hempstead	NY	5312
New Hyde Park	NY	9811
New Paltz	NY	7070
New Rochelle	NY	79846
New Springville	NY	20756
New Square	NY	8057
New Suffolk	NY	349
New Windsor	NY	8922
New York	NY	0
New York City	NY	8804190
New York Mills	NY	3308
Newark	NY	8843
Newark Valley	NY	957
Newburgh	NY	28290
Newcomb	NY	422
Newfane	NY	3822
Newfield	NY	0
Newfield Hamlet	NY	759
Newport	NY	620
Niagara Falls	NY	48916
Niagara University	NY	0
Nichols	NY	485
Niskayuna	NY	4859
Nissequogue	NY	1760
Niverville	NY	1662
Norfolk	NY	1327
North Amityville	NY	17862
North Babylon	NY	17509
North Ballston Spa	NY	1338
North Bay	NY	0
North Bay Shore	NY	18944
North Bellmore	NY	19941
North Bellport	NY	11545
North Blenheim	NY	0
North Boston	NY	2521
North Castle	NY	12304
North Collins	NY	1225
North Creek	NY	616
North Elba	NY	8474
North Gates	NY	9512
North Granville	NY	0
North Great River	NY	4001
North Haven	NY	872
North Hills	NY	5444
North Hornell	NY	747
North Lindenhurst	NY	11652
North Lynbrook	NY	793
North Massapequa	NY	17886
North Merrick	NY	12272
North New Hyde Park	NY	14899
North Patchogue	NY	7246
North Rose	NY	636
North Sea	NY	4458
North Syracuse	NY	6853
North Tonawanda	NY	30785
North Valley Stream	NY	16628
North Wantagh	NY	11960
Northampton	NY	570
Northeast Ithaca	NY	2641
Northport	NY	7390
Northumberland	NY	5159
Northville	NY	1340
Northwest Harbor	NY	3317
Northwest Ithaca	NY	1413
Norwich	NY	6968
Norwood	NY	1614
Noyack	NY	3568
Nunda	NY	1328
Nyack	NY	7004
Oak Beach	NY	0
Oakdale	NY	8107
Oakfield	NY	1762
Oakwood	NY	11148
Oakwood Heights Station	NY	56
Ocean Beach	NY	81
Oceanside	NY	32109
Odessa	NY	573
Ogdensburg	NY	10883
Olcott	NY	1241
Old Bethpage	NY	5523
Old Brookville	NY	2214
Old Field	NY	914
Old Forge	NY	756
Old Westbury	NY	4678
Olean	NY	13870
Oneida	NY	11134
Oneida Castle	NY	627
Oneonta	NY	13862
Ontario	NY	2160
Orange Lake	NY	6982
Orangeburg	NY	4568
Orchard Park	NY	3206
Orient	NY	743
Oriskany	NY	1375
Oriskany Falls	NY	703
Ossining	NY	25441
Oswego	NY	17787
Otego	NY	973
Otisville	NY	1046
Otter Lake	NY	0
Ovid	NY	624
Owego	NY	3736
Oxbow	NY	108
Oxford	NY	1411
Oyster Bay	NY	6707
Oyster Bay Cove	NY	2251
Ozone Park	NY	53985
Painted Post	NY	1997
Palatine Bridge	NY	757
Palenville	NY	1037
Palmyra	NY	3413
Pamelia Center	NY	264
Panama	NY	456
Parc	NY	254
Parish	NY	438
Parishville	NY	647
Park Slope	NY	65047
Parkchester	NY	65876
Patchogue	NY	12463
Paul Smiths	NY	671
Pavilion	NY	646
Pawling	NY	2297
Peach Lake	NY	1629
Pearl River	NY	15876
Peconic	NY	683
Peekskill	NY	24043
Pelham	NY	7048
Pelham Manor	NY	5594
Penn Yan	NY	5014
Perry	NY	3516
Perrysburg	NY	401
Perth	NY	3646
Peru	NY	1591
Phelps	NY	1945
Philadelphia	NY	1223
Philmont	NY	1318
Phoenicia	NY	309
Phoenix	NY	2311
Piermont	NY	2573
Pierrepont Manor	NY	228
Piffard	NY	220
Pike	NY	371
Pine Bush	NY	1780
Pine Hill	NY	275
Pine Plains	NY	1353
Pine Valley	NY	813
Pittsford	NY	1350
Plainedge	NY	8817
Plainview	NY	26217
Plandome	NY	1405
Plandome Heights	NY	1026
Plandome Manor	NY	881
Plattekill	NY	1260
Plattsburgh	NY	19806
Plattsburgh West	NY	1364
Pleasant Plains	NY	808
Pleasant Valley	NY	1145
Pleasantville	NY	7173
Plessis	NY	164
Poestenkill	NY	1061
Point Lookout	NY	1219
Poland	NY	500
Pomona	NY	3103
Poquott	NY	947
Port Byron	NY	1243
Port Chester	NY	29620
Port Dickinson	NY	1594
Port Ewen	NY	3546
Port Gibson	NY	453
Port Henry	NY	1148
Port Jefferson	NY	7842
Port Jefferson Station	NY	7838
Port Jervis	NY	8609
Port Leyden	NY	668
Port Morris	NY	1978
Port Richmond	NY	15470
Port Washington	NY	15846
Port Washington North	NY	3207
Portland	NY	4694
Portlandville	NY	0
Portville	NY	978
Potsdam	NY	9688
Pottersville	NY	424
Poughkeepsie	NY	30371
Pound Ridge	NY	5104
Prattsburgh	NY	656
Prattsville	NY	355
Preston-Potter Hollow	NY	366
Prospect	NY	291
Pulaski	NY	2310
Pultneyville	NY	698
Purchase	NY	4660
Putnam Lake	NY	3844
Queens	NY	2316841
Queens Village	NY	51919
Queensbury	NY	27703
Quiogue	NY	816
Quogue	NY	991
Radisson	NY	0
Randolph	NY	1286
Ransomville	NY	1419
Rapids	NY	1636
Ravena	NY	3267
Red Creek	NY	513
Red Hook	NY	1990
Red Oaks Mill	NY	3613
Redfield	NY	573
Redford	NY	477
Redwood	NY	605
Rego Park	NY	43925
Remsen	NY	497
Remsenburg-Speonk	NY	2642
Rensselaer	NY	9433
Rensselaer Falls	NY	322
Retsof	NY	340
Rhinebeck	NY	2609
Rhinecliff	NY	425
Richburg	NY	441
Richfield Springs	NY	1225
Richland	NY	5661
Richmond Hill	NY	98984
Richmondville	NY	871
Richville	NY	320
Ridge	NY	13336
Ridgewood	NY	69317
Rifton	NY	456
Ripley	NY	872
Riverdale	NY	9174
Riverhead	NY	13299
Riverside	NY	2911
Rochester	NY	209802
Rochester Institute of Technology	NY	0
Rock Hill	NY	1742
Rockaway Point	NY	4096
Rockville Centre	NY	24201
Rocky Point	NY	14014
Rodman	NY	153
Roessleville	NY	10753
Rome	NY	32573
Romulus	NY	409
Ronkonkoma	NY	19082
Roosevelt	NY	16258
Roosevelt Island	NY	11722
Roscoe	NY	541
Rosebank	NY	4152
Rosedale	NY	25812
Rosendale	NY	0
Rosendale Village	NY	1349
Roslyn	NY	2795
Roslyn Estates	NY	1265
Roslyn Harbor	NY	1093
Roslyn Heights	NY	6577
Rossville	NY	18792
Rotterdam	NY	20652
Round Lake	NY	621
Round Top	NY	0
Rouses Point	NY	2169
Ruby	NY	0
Rush	NY	3478
Rushford	NY	363
Rushville	NY	665
Russell Gardens	NY	951
Rye	NY	16046
Rye Brook	NY	9611
Sackets Harbor	NY	1490
Saddle Rock	NY	877
Saddle Rock Estates	NY	466
Sag Harbor	NY	2282
Sagaponack	NY	325
Saint Bonaventure	NY	2044
Saint James	NY	13338
Saint Johnsville	NY	1732
Saint Regis Falls	NY	464
Salamanca	NY	5586
Salem	NY	929
Salisbury	NY	12093
Salisbury Center	NY	0
Salisbury Mills	NY	536
Salt Point	NY	190
Saltaire	NY	37
Sanborn	NY	1645
Sand Ridge	NY	849
Sands Point	NY	2752
Sandy Creek	NY	745
Saranac Lake	NY	5274
Saratoga Springs	NY	27765
Saugerties	NY	3903
Saugerties South	NY	2218
Savannah	NY	558
Savona	NY	808
Sayville	NY	16853
Scarsdale	NY	17885
Schaghticoke	NY	588
Schenectady	NY	65305
Schenevus	NY	551
Schoharie	NY	838
Schroon Lake	NY	833
Schuyler Lake	NY	0
Schuylerville	NY	1374
Scio	NY	609
Scotchtown	NY	9212
Scotia	NY	7727
Scotts Corners	NY	711
Scottsburg	NY	117
Scottsville	NY	1977
Sea Cliff	NY	5025
Seaford	NY	15294
Searingtown	NY	4915
Seaside	NY	12754
Selden	NY	19851
Seneca Falls	NY	6681
Seneca Knolls	NY	2011
Setauket	NY	0
Setauket-East Setauket	NY	15477
Sharon Springs	NY	528
Sheepshead Bay	NY	122534
Shelter Island	NY	1333
Shelter Island Heights	NY	1048
Shenorock	NY	1898
Sherburne	NY	1332
Sherman	NY	701
Sherrill	NY	3066
Shinnecock Hills	NY	2188
Shirley	NY	27854
Shokan	NY	1183
Shoreham	NY	535
Shorehaven	NY	0
Shortsville	NY	1429
Shrub Oak	NY	2011
Sidney	NY	3755
Siena College	NY	0
Silver Creek	NY	2545
Silver Springs	NY	750
Sinclairville	NY	565
Skaneateles	NY	2474
Slaterville Springs	NY	0
Sleepy Hollow	NY	10242
Sleepy Hollow Lake	NY	0
Sloan	NY	3601
Sloatsburg	NY	3135
Smallwood	NY	580
Smithtown	NY	26470
Smithville Flats	NY	351
Smyrna	NY	207
Sodus	NY	1755
Sodus Point	NY	878
Solvay	NY	6425
Sound Beach	NY	7612
South Beach	NY	8029
South Blooming Grove	NY	3188
South Cairo	NY	0
South Corning	NY	1124
South Dayton	NY	594
South Edmeston	NY	0
South Fallsburg	NY	2870
South Farmingdale	NY	14486
South Floral Park	NY	1787
South Glens Falls	NY	3580
South Hempstead	NY	3243
South Hill	NY	6673
South Huntington	NY	9422
South Ilion	NY	0
South Lansing	NY	0
South Lima	NY	240
South Lockport	NY	8324
South Nyack	NY	3535
South Ozone Park	NY	75878
South Valley Stream	NY	5962
Southampton	NY	3265
Southold	NY	5748
Southport	NY	7238
Spackenkill	NY	4123
Sparkill	NY	1565
Sparrow Bush	NY	2097
Speculator	NY	314
Spencer	NY	731
Spencerport	NY	3589
Spring Valley	NY	32598
Springfield	NY	1312
Springfield Center	NY	0
Springfield Gardens	NY	30515
Springs	NY	6592
Springville	NY	4339
Springwater	NY	0
Springwater Hamlet	NY	549
Spuyten Duyvil	NY	10971
St. Bonaventure	NY	0
St. James	NY	0
St. John Fisher College	NY	0
St. Johnsville	NY	0
St. Regis Falls	NY	0
Staatsburg	NY	377
Stamford	NY	1071
Stannards	NY	798
Stapleton	NY	5365
Star Lake	NY	809
Staten Island	NY	468730
Steinway	NY	1648
Stewart Manor	NY	1914
Stillwater	NY	1732
Stittville	NY	0
Stone Ridge	NY	1173
Stony Brook	NY	13740
Stony Brook University	NY	0
Stony Point	NY	12147
Stottville	NY	1375
Strykersville	NY	647
Suffern	NY	11001
Sunnyside	NY	49833
Sunset Bay	NY	660
Sunset Park	NY	126000
SUNY Oswego	NY	0
Swan Lake	NY	0
Sylvan Beach	NY	1059
Syosset	NY	18829
Syracuse	NY	144142
Taconic Shores	NY	0
Tannersville	NY	512
Tappan	NY	6613
Tarrytown	NY	11560
Terrace Heights	NY	15421
Terryville	NY	11849
Test	NY	77
The Bronx	NY	1385108
Thendara	NY	0
Theresa	NY	843
Thiells	NY	5032
Thomaston	NY	2639
Thornwood	NY	3759
Thousand Island Park	NY	31
Three Mile Bay	NY	227
Throgs Neck	NY	33683
Ticonderoga	NY	3382
Tillson	NY	1586
Times Square	NY	17749
Tioga Terrace	NY	0
Titusville	NY	811
Tivoli	NY	1099
Tompkinsville	NY	8343
Tonawanda	NY	14907
Town Line	NY	2367
Tremont	NY	22870
Tribeca	NY	7811
Tribes Hill	NY	1003
Troy	NY	49906
Trumansburg	NY	1828
Tuckahoe	NY	6643
Tully	NY	870
Tupper Lake	NY	3577
Turin	NY	230
Tuscarora	NY	74
Tuxedo	NY	0
Tuxedo Park	NY	623
Unadilla	NY	1088
Unadilla Forks	NY	0
Union Springs	NY	1175
Uniondale	NY	24759
Unionport	NY	23895
Unionville	NY	593
University at Buffalo	NY	0
University Gardens	NY	4226
University Heights	NY	27935
Upper Brookville	NY	1753
Upper Nyack	NY	2176
Upper Red Hook	NY	0
Upper West Side	NY	226989
Utica	NY	61100
Vails Gate	NY	3369
Valatie	NY	1911
Valhalla	NY	3162
Valley Cottage	NY	9107
Valley Falls	NY	458
Valley Stream	NY	37962
Van Etten	NY	519
Van Nest	NY	23700
Varna	NY	0
Vassar College	NY	0
Vernon	NY	1157
Verona	NY	852
Verplanck	NY	1729
Vestal	NY	28043
Victor	NY	2759
Victory	NY	548
Victory Mills	NY	621
Village Green	NY	3891
Village of the Branch	NY	1811
Viola	NY	6868
Virgil	NY	0
Volney	NY	5801
Voorheesville	NY	2832
Waddington	NY	968
Wading River	NY	7719
Wadsworth	NY	190
Wainscott	NY	650
Wakefield	NY	52201
Walden	NY	6839
Walker Valley	NY	853
Wallkill	NY	2288
Walton	NY	2930
Walton Park	NY	2669
Walworth	NY	0
Wampsville	NY	546
Wanakah	NY	3199
Wantagh	NY	18871
Wappingers Falls	NY	5552
Warrensburg	NY	3103
Warsaw	NY	3376
Warwick	NY	6823
Washington Heights	NY	152613
Washington Mills	NY	1183
Washingtonville	NY	5788
Wassaic	NY	0
Watchtower	NY	2381
Water Mill	NY	1559
Waterford	NY	2037
Waterloo	NY	5036
Watertown	NY	26780
Waterville	NY	1551
Watervliet	NY	10214
Watkins Glen	NY	1859
Waverly	NY	4264
Wawarsing	NY	12925
Wayland	NY	1813
Webster	NY	5534
Websters Crossing	NY	69
Weedsport	NY	1761
Wells	NY	0
Wells Bridge	NY	0
Wellsburg	NY	555
Wellsville	NY	4753
Wesley Hills	NY	5935
West Albany	NY	93794
West Babylon	NY	43213
West Bay Shore	NY	4648
West Carthage	NY	2065
West Chazy	NY	529
West Danby	NY	0
West Elmira	NY	4967
West End	NY	1940
West Farms	NY	772
West Glens Falls	NY	7071
West Hampton Dunes	NY	58
West Haverstraw	NY	10421
West Hempstead	NY	18862
West Henrietta	NY	11691
West Hills	NY	5592
West Hurley	NY	1939
West Islip	NY	28335
West Kill	NY	0
West Nyack	NY	3439
West Point	NY	6763
West Sand Lake	NY	2660
West Sayville	NY	5011
West Seneca	NY	44711
West Valley	NY	518
West Village	NY	32518
West Winfield	NY	873
Westbury	NY	15379
Westerleigh	NY	8927
Westernville	NY	0
Westfield	NY	3090
Westford	NY	0
Westhampton	NY	3079
Westhampton Beach	NY	1721
Westmere	NY	7284
Westmoreland	NY	427
Weston Mills	NY	1472
Westons Mills	NY	1750
Westport	NY	518
Westvale	NY	4963
Wheatley Heights	NY	5130
White Lake	NY	0
White Plains	NY	58459
Whitehall	NY	2582
Whitesboro	NY	3694
Whitestone	NY	36984
Whitney Point	NY	941
Williamsburg	NY	33000
Williamson	NY	2495
Williamsville	NY	5254
Williston Park	NY	7331
Willowbrook	NY	2930
Willsboro	NY	753
Willsboro Point	NY	0
Wilmington	NY	937
Wilson	NY	1231
Wilton	NY	17361
Windham	NY	367
Windsor	NY	896
Wingdale	NY	0
Winthrop	NY	510
Witherbee	NY	347
Wolcott	NY	1645
Woodbourne	NY	0
Woodbury	NY	10879
Woodhaven	NY	36555
Woodlawn	NY	7317
Woodmere	NY	17121
Woodridge	NY	797
Woodrow	NY	21005
Woodsburgh	NY	783
Woodside	NY	41981
Woodstock	NY	2088
Woodsville	NY	80
Worcester	NY	1113
Wurtsboro	NY	1173
Wurtsboro Hills	NY	0
Wyandanch	NY	11647
Wykagyl	NY	14146
Wynantskill	NY	3276
Wyoming	NY	425
Yaphank	NY	5945
Yonkers	NY	201116
York	NY	0
York Hamlet	NY	544
Yorkshire	NY	1180
Yorktown Heights	NY	1781
Yorkville	NY	2634
Youngstown	NY	1921
Zena	NY	1031
Aberdeen	OH	1607
Ada	OH	5811
Adamsville	OH	116
Addyston	OH	931
Adelphi	OH	374
Adena	OH	730
Ai	OH	0
Akron	OH	197542
Albany	OH	905
Alexandria	OH	523
Alger	OH	845
Alliance	OH	22055
Alvordton	OH	217
Amanda	OH	747
Amberley	OH	3591
Amelia	OH	4932
Amesville	OH	158
Amherst	OH	12135
Amsterdam	OH	549
Andersonville	OH	779
Andover	OH	1119
Anna	OH	1545
Ansonia	OH	1150
Antioch	OH	89
Antwerp	OH	1692
Apple Creek	OH	1184
Apple Valley	OH	5058
Aquilla	OH	340
Arcadia	OH	584
Arcanum	OH	2087
Archbold	OH	4341
Arlington	OH	1453
Arlington Heights	OH	740
Ashland	OH	20317
Ashley	OH	1361
Ashtabula	OH	18371
Ashville	OH	4190
Athalia	OH	368
Athens	OH	25044
Attica	OH	879
Atwater	OH	758
Aurora	OH	15838
Austinburg	OH	516
Austintown	OH	29677
Avon	OH	22544
Avon Center	OH	15724
Avon Lake	OH	23453
Bailey Lake	OH	371
Bailey Lakes	OH	0
Bainbridge	OH	3267
Bairdstown	OH	133
Ballville	OH	2976
Baltic	OH	789
Baltimore	OH	2970
Bannock	OH	211
Barberton	OH	26234
Barnesville	OH	4125
Barnhill	OH	387
Bascom	OH	390
Bass Lake	OH	0
Batavia	OH	1648
Batesville	OH	98
Bay	OH	0
Bay View	OH	660
Bay Village	OH	15402
Beach	OH	0
Beach City	OH	1011
Beachwood	OH	11762
Beallsville	OH	404
Beaver	OH	439
Beavercreek	OH	46277
Beaverdam	OH	369
Beckett Ridge	OH	9187
Bedford	OH	12747
Bedford Heights	OH	10625
Beechwood Trails	OH	3020
Bellaire	OH	4189
Bellbrook	OH	7053
Belle Center	OH	798
Belle Valley	OH	217
Bellefontaine	OH	13117
Bellevue	OH	8005
Bellville	OH	1871
Belmont	OH	519
Belmore	OH	140
Beloit	OH	939
Belpre	OH	6476
Bentleyville	OH	857
Benton Ridge	OH	304
Bentonville	OH	287
Berea	OH	18874
Bergholz	OH	636
Berkey	OH	237
Berlin	OH	898
Berlin Heights	OH	690
Bethel	OH	2771
Bethesda	OH	1245
Bettsville	OH	642
Beulah Beach	OH	53
Beverly	OH	1308
Bexley	OH	13654
Bidwell	OH	0
Birmingham	OH	0
Blacklick Estates	OH	8682
Bladensburg	OH	191
Blaine	OH	0
Blakeslee	OH	95
Blanchester	OH	4246
Bloomdale	OH	692
Bloomingburg	OH	921
Bloomingdale	OH	197
Bloomingville	OH	0
Bloomville	OH	933
Blue Ash	OH	12159
Blue Jay	OH	959
Bluffton	OH	4161
Boardman	OH	35376
Bolindale	OH	2089
Bolivar	OH	992
Bolton	OH	0
Boston Heights	OH	1292
Botkins	OH	1152
Bourneville	OH	199
Bowerston	OH	393
Bowersville	OH	313
Bowling Green	OH	31246
Bradford	OH	1847
Bradner	OH	1019
Brady Lake	OH	464
Brandt	OH	0
Bratenahl	OH	1171
Brecksville	OH	13440
Brecon	OH	244
Bremen	OH	1437
Brewster	OH	2169
Briarwood Beach	OH	766
Brice	OH	121
Bridgeport	OH	1794
Bridgetown	OH	14407
Brilliant	OH	1482
Brimfield	OH	3343
Brinkhaven	OH	193
Broadview Heights	OH	19229
Brook Park	OH	18809
Brookfield Center	OH	1207
Brooklyn	OH	10899
Brooklyn Heights	OH	1543
Brookside	OH	614
Brookville	OH	5900
Broughton	OH	117
Brownsville	OH	220
Brunersburg	OH	0
Brunswick	OH	34689
Bryan	OH	8436
Buchtel	OH	557
Buckeye Lake	OH	2760
Buckland	OH	231
Bucyrus	OH	11916
Buffalo	OH	401
Buford	OH	352
Burbank	OH	208
Burgoon	OH	170
Burkettsville	OH	247
Burlington	OH	2676
Burton	OH	1461
Butler	OH	912
Butlerville	OH	166
Byesville	OH	2375
Cadiz	OH	3271
Cairo	OH	531
Calcutta	OH	3742
Caldwell	OH	1690
Caledonia	OH	557
Cambridge	OH	10402
Camden	OH	2281
Camp Dennison	OH	375
Campbell	OH	7982
Canal Fulton	OH	5487
Canal Lewisville	OH	320
Canal Winchester	OH	7818
Candlewood Lake	OH	0
Canfield	OH	7355
Canton	OH	71885
Carbon Hill	OH	233
Cardington	OH	2047
Carey	OH	3586
Carlisle	OH	5259
Carroll	OH	520
Carrollton	OH	3137
Casstown	OH	271
Castalia	OH	832
Castine	OH	128
Catawba	OH	265
Cecil	OH	185
Cedarville	OH	4177
Celeryville	OH	210
Celina	OH	10387
Centerburg	OH	2052
Centerville	OH	23882
Centerville (Thurman)	OH	0
Chagrin Falls	OH	4021
Champion Heights	OH	6498
Chardon	OH	5148
Chatfield	OH	189
Chauncey	OH	1039
Cherry Fork	OH	156
Cherry Grove	OH	4378
Chesapeake	OH	726
Cheshire	OH	131
Chesterhill	OH	285
Chesterland	OH	2521
Chesterville	OH	230
Cheviot	OH	8295
Chickasaw	OH	301
Chillicothe	OH	21727
Chilo	OH	63
Chippewa Lake	OH	720
Chippewa Park	OH	891
Chippewa-on-the-Lake	OH	293
Choctaw Lake	OH	1546
Christiansburg	OH	504
Churchill	OH	2149
Cincinnati	OH	311097
Cinnamon Lake	OH	0
Circleville	OH	13857
Clarington	OH	380
Clark-Fulton	OH	18185
Clarksburg	OH	459
Clarksville	OH	547
Clarktown	OH	958
Clay Center	OH	283
Clayton	OH	13146
Cleveland	OH	365379
Cleveland Heights	OH	44962
Cleves	OH	3386
Clifton	OH	151
Clinton	OH	1214
Cloverdale	OH	165
Clyde	OH	6260
Coal Grove	OH	2143
Coalton	OH	465
Coldstream	OH	0
Coldwater	OH	4487
College Corner	OH	410
Collins	OH	631
Collinwood	OH	34220
Columbiana	OH	6291
Columbus	OH	913175
Columbus Grove	OH	2063
Commercial Point	OH	1611
Concorde Hills	OH	663
Conesville	OH	346
Congress	OH	186
Conneaut	OH	12712
Connorville	OH	0
Continental	OH	1119
Convoy	OH	1068
Coolville	OH	493
Copley	OH	13641
Corning	OH	573
Cortland	OH	6927
Corwin	OH	441
Coshocton	OH	11121
Covedale	OH	6447
Covington	OH	2625
Craig Beach	OH	1143
Crestline	OH	4438
Creston	OH	2181
Cridersville	OH	1828
Crooksville	OH	2498
Croton	OH	451
Crown	OH	0
Crown City	OH	402
Crystal Lakes	OH	1483
Crystal Rock	OH	176
Cumberland	OH	359
Curtice	OH	1526
Custar	OH	183
Cuyahoga Falls	OH	49146
Cuyahoga Heights	OH	617
Cygnet	OH	617
Cynthiana	OH	68
Dalton	OH	1850
Damascus	OH	443
Danville	OH	1018
Darbydale	OH	793
Darbyville	OH	229
Darrtown	OH	516
Day Heights	OH	2620
Dayton	OH	135512
De Graff	OH	1263
Deer Park	OH	5682
Deersville	OH	78
Defiance	OH	16776
Delaware	OH	37995
Delhi Hills	OH	5259
Dellroy	OH	346
Delphos	OH	7023
Delshire	OH	0
Delta	OH	3121
Dennison	OH	2640
Dent	OH	10497
Derby	OH	408
Deshler	OH	1781
Detroit-Shoreway	OH	17382
Devola	OH	2652
Dexter	OH	0
Dexter City	OH	126
Dillonvale	OH	3474
Dola	OH	140
Donnelsville	OH	300
Dover	OH	12899
Doylestown	OH	3075
Dresden	OH	1706
Drexel	OH	2076
Dry Ridge	OH	2782
Dry Run	OH	7281
Dublin	OH	45098
Duncan Falls	OH	880
Dundee	OH	297
Dunkirk	OH	862
Dunlap	OH	1719
Dupont	OH	308
East Alliance	OH	0
East Canton	OH	1600
East Cleveland	OH	17344
East Fultonham	OH	335
East Liberty	OH	366
East Liverpool	OH	10846
East Palestine	OH	4576
East Rochester	OH	231
East Sparta	OH	804
East Springfield	OH	0
Eastlake	OH	18232
Eaton	OH	8217
Eaton Estates	OH	1222
Edgerton	OH	1982
Edgewood	OH	4432
Edison	OH	435
Edon	OH	818
Eldorado	OH	499
Elgin	OH	56
Elida	OH	1858
Elizabethtown	OH	350
Elmore	OH	1393
Elmwood Place	OH	2164
Elyria	OH	53775
Empire	OH	283
Englewood	OH	13460
Enon	OH	2393
Etna	OH	1215
Euclid	OH	47676
Evendale	OH	2767
Fairborn	OH	33452
Fairfax	OH	1703
Fairfield	OH	42767
Fairfield Beach	OH	1292
Fairlawn	OH	7413
Fairport Harbor	OH	3096
Fairview	OH	82
Fairview Park	OH	16407
Farmersville	OH	1006
Fayette	OH	1268
Fayetteville	OH	321
Felicity	OH	828
Findlay	OH	41149
Finneytown	OH	12741
Five Points	OH	1824
Flat Rock	OH	233
Fletcher	OH	480
Florida	OH	230
Flushing	OH	863
Forest	OH	1441
Forest Park	OH	18676
Forestville	OH	10532
Fort Jennings	OH	478
Fort Loramie	OH	1491
Fort McKinley	OH	3989
Fort Recovery	OH	1429
Fort Seneca	OH	254
Fort Shawnee	OH	3726
Fostoria	OH	13167
Four Bridges	OH	0
Frankfort	OH	1065
Franklin	OH	11783
Franklin Furnace	OH	1660
Frazeysburg	OH	1322
Fredericksburg	OH	423
Fredericktown	OH	2488
Freeport	OH	358
Fremont	OH	16297
Fresno	OH	140
Friendship	OH	351
Fruit Hill	OH	3755
Fulton	OH	261
Fultonham	OH	179
Gahanna	OH	34590
Galena	OH	698
Galion	OH	10127
Gallipolis	OH	3469
Gambier	OH	2437
Gann (Brinkhaven)	OH	0
Garfield Heights	OH	28097
Garrettsville	OH	2328
Gates Mills	OH	2235
Geneva	OH	6447
Geneva-on-the-Lake	OH	1214
Genoa	OH	2331
Georgetown	OH	4447
Germantown	OH	5503
Gettysburg	OH	505
Gibsonburg	OH	2564
Gilboa	OH	186
Girard	OH	9599
Glandorf	OH	1006
Glencoe	OH	310
Glendale	OH	2164
Glenford	OH	177
Glenmont	OH	284
Glenmoor	OH	1987
Glenville	OH	23559
Glenwillow	OH	926
Gloria Glens Park	OH	430
Glouster	OH	1797
Gnadenhutten	OH	1289
Golf Manor	OH	3583
Gomer	OH	0
Good Hope	OH	234
Gordon	OH	208
Goshen	OH	11644
Grafton	OH	6165
Grand Rapids	OH	999
Grand River	OH	397
Grandview	OH	1466
Grandview Heights	OH	7328
Granville	OH	5747
Granville South	OH	1410
Gratiot	OH	224
Gratis	OH	859
Graysville	OH	76
Green	OH	25898
Green Camp	OH	364
Green Meadows	OH	2327
Green Springs	OH	1332
Greenfield	OH	4572
Greenhills	OH	3593
Greensburg	OH	3306
Greentown	OH	3804
Greenville	OH	13006
Greenwich	OH	1429
Groesbeck	OH	6788
Grove	OH	0
Grove City	OH	39388
Groveport	OH	5737
Grover Hill	OH	381
Guilford Lake	OH	0
Hamburg	OH	0
Hamden	OH	863
Hamersville	OH	533
Hamilton	OH	62407
Hamler	OH	568
Hanging Rock	OH	218
Hannibal	OH	411
Hanover	OH	1131
Hanoverton	OH	400
Harbor Hills	OH	1509
Harbor View	OH	99
Harpster	OH	201
Harrisburg	OH	334
Harrison	OH	9897
Harrisville	OH	232
Harrod	OH	412
Hartford	OH	384
Hartford (Croton)	OH	0
Hartville	OH	2968
Harveysburg	OH	551
Haskins	OH	1232
Haviland	OH	212
Haydenville	OH	381
Hayesville	OH	463
Heath	OH	10489
Hebron	OH	2409
Helena	OH	221
Hemlock	OH	156
Hessville	OH	214
Hicksville	OH	3457
Hidden Lakes	OH	0
Hide-A-Way Hills	OH	794
Higginsport	OH	244
Highland	OH	253
Highland Heights	OH	8396
Highland Hills	OH	961
Highland Holiday	OH	550
Highpoint	OH	1503
Hilliard	OH	33649
Hills and Dales	OH	220
Hillsboro	OH	6557
Hilltop	OH	532
Hiram	OH	1263
Hockingport	OH	212
Holgate	OH	1096
Holiday	OH	0
Holiday City	OH	52
Holiday Lakes	OH	0
Holiday Valley	OH	1510
Holland	OH	1699
Hollansburg	OH	223
Holloway	OH	325
Holmesville	OH	388
Homeworth	OH	481
Hooven	OH	534
Hopedale	OH	927
Hough	OH	16359
Howard	OH	242
Howland Center	OH	6351
Hoytville	OH	300
Hubbard	OH	7650
Huber Heights	OH	38176
Huber Ridge	OH	4604
Hudson	OH	22437
Hunter	OH	2100
Hunting Valley	OH	720
Huntsville	OH	427
Huron	OH	7022
Iberia	OH	452
Independence	OH	7135
Irondale	OH	367
Ironton	OH	10900
Ithaca	OH	134
Jackson	OH	6243
Jackson Center	OH	1453
Jacksonburg	OH	64
Jacksontown	OH	0
Jacksonville	OH	484
Jamestown	OH	2027
Jefferson	OH	3041
Jeffersonville	OH	1192
Jenera	OH	223
Jeromesville	OH	562
Jerry	OH	0
Jerry City	OH	436
Jersey	OH	0
Jerusalem	OH	161
Jewett	OH	671
Johnstown	OH	4918
Junction	OH	0
Junction City	OH	810
Kalida	OH	1562
Kanauga	OH	175
Kansas	OH	179
Kelleys Island	OH	312
Kent	OH	29810
Kenton	OH	8211
Kenwood	OH	6981
Kettering	OH	55525
Kettlersville	OH	177
Kidron	OH	944
Kilbourne	OH	139
Killbuck	OH	843
Kimbolton	OH	144
Kings Mills	OH	1319
Kingston	OH	1024
Kingsville	OH	0
Kinsman Center	OH	616
Kipton	OH	242
Kirby	OH	116
Kirkersville	OH	541
Kirtland	OH	6793
Kirtland Hills	OH	641
Kunkle	OH	246
La Croft	OH	1144
La Rue	OH	717
Lafayette	OH	428
Lafferty	OH	304
Lagrange	OH	2103
Lake Buckhorn	OH	0
Lake Darby	OH	4592
Lake Lakengren	OH	3383
Lake Lorelei	OH	0
Lake Milton	OH	0
Lake Mohawk	OH	1652
Lake Seneca	OH	465
Lake Tomahawk	OH	0
Lake Waynoka	OH	0
Lakeline	OH	226
Lakemore	OH	3048
Lakeside	OH	694
Lakeview	OH	1047
Lakewood	OH	50656
Lancaster	OH	39766
Landen	OH	6782
Lansing	OH	634
Latty	OH	188
Laura	OH	469
Laurelville	OH	517
Lawrenceville	OH	284
Leavittsburg	OH	1973
Lebanon	OH	20623
Leesburg	OH	1294
Leesville	OH	187
Leetonia	OH	1904
Leipsic	OH	2032
Lewis Center	OH	11261
Lewisburg	OH	1770
Lewistown	OH	222
Lewisville	OH	176
Lexington	OH	4731
Liberty Center	OH	1154
Lima	OH	37873
Limaville	OH	150
Lincoln	OH	0
Lincoln Heights	OH	3831
Lincoln Village	OH	9032
Lindsey	OH	430
Linndale	OH	179
Lisbon	OH	2845
Lithopolis	OH	1351
Little Hocking	OH	263
Lloydsville	OH	0
Lockbourne	OH	247
Lockington	OH	139
Lockland	OH	3426
Lodi	OH	2768
Logan	OH	7117
Logan Elm	OH	0
Logan Elm Village	OH	1118
London	OH	10060
Lorain	OH	63647
Lordstown	OH	3300
Lore	OH	0
Lore City	OH	319
Loudonville	OH	2625
Louisville	OH	9126
Loveland	OH	12585
Loveland Park	OH	1523
Lowell	OH	548
Lowellville	OH	1107
Lower Salem	OH	86
Lucas	OH	604
Lucasville	OH	2757
Luckey	OH	1050
Ludlow Falls	OH	211
Lynchburg	OH	1487
Lyndhurst	OH	13691
Lyons	OH	550
Macedonia	OH	11686
Mack	OH	11585
Macksburg	OH	186
Madeira	OH	8976
Madison	OH	3182
Madison Place	OH	0
Magnetic Springs	OH	276
Magnolia	OH	973
Maineville	OH	979
Malinta	OH	264
Malta	OH	657
Malvern	OH	1155
Manchester	OH	2048
Mansfield	OH	46830
Mantua	OH	1021
Maple Heights	OH	22631
Maple Ridge	OH	761
Maplewood Park	OH	280
Marathon	OH	0
Marble Cliff	OH	584
Marblehead	OH	888
Marengo	OH	346
Maria Stein	OH	0
Mariemont	OH	3426
Marietta	OH	13900
Marion	OH	36363
Marlboro	OH	0
Marne	OH	783
Marseilles	OH	110
Marshallville	OH	760
Martins Ferry	OH	6786
Martinsburg	OH	232
Martinsville	OH	464
Marysville	OH	22817
Mason	OH	32662
Massieville	OH	0
Massillon	OH	32252
Masury	OH	2064
Matamoras (New Matamoras)	OH	0
Maumee	OH	13940
Mayfield	OH	3403
Mayfield Heights	OH	18840
McArthur	OH	1664
McClure	OH	709
McComb	OH	1644
McConnelsville	OH	1789
McCutchenville	OH	400
McDermott	OH	434
McDonald	OH	3152
McGuffey	OH	488
McKinley Heights	OH	1060
Mechanicsburg	OH	1599
Medina	OH	26339
Medway	OH	0
Melmore	OH	153
Melrose	OH	268
Mendon	OH	650
Mentor	OH	46901
Mentor-on-the-Lake	OH	7443
Metamora	OH	613
Meyers Lake	OH	573
Miami Heights	OH	4731
Miamisburg	OH	20034
Miamitown	OH	1259
Miamiville	OH	242
Middle Point	OH	565
Middlebranch	OH	0
Middleburg Heights	OH	15696
Middlefield	OH	2693
Middleport	OH	2474
Middletown	OH	48760
Midland	OH	316
Midvale	OH	749
Midway	OH	327
Mifflin	OH	137
Milan	OH	1347
Milford	OH	6876
Milford Center	OH	823
Millbury	OH	1249
Milledgeville	OH	113
Miller	OH	0
Miller City	OH	139
Millersburg	OH	3151
Millersport	OH	1049
Millfield	OH	341
Millville	OH	724
Milton Center	OH	147
Miltonsburg	OH	43
Mineral	OH	0
Mineral City	OH	723
Mineral Ridge	OH	3892
Minerva	OH	3678
Minerva Park	OH	1318
Minford	OH	693
Mingo Junction	OH	3324
Minster	OH	2845
Mitiwanga	OH	0
Mogadore	OH	3909
Monfort Heights	OH	11948
Monroe	OH	13393
Monroeville	OH	1370
Montezuma	OH	161
Montgomery	OH	10506
Montpelier	OH	3993
Montrose-Ghent	OH	5177
Moraine	OH	6373
Moreland Hills	OH	3307
Morgandale	OH	1224
Morral	OH	384
Morristown	OH	302
Morrow	OH	1272
Moscow	OH	186
Mount Blanchard	OH	484
Mount Carmel	OH	4741
Mount Cory	OH	205
Mount Eaton	OH	242
Mount Gilead	OH	3653
Mount Healthy	OH	6039
Mount Healthy Heights	OH	3264
Mount Hope	OH	0
Mount Orab	OH	3660
Mount Pleasant	OH	455
Mount Repose	OH	4672
Mount Sterling	OH	1745
Mount Vernon	OH	16742
Mount Victory	OH	622
Mowrystown	OH	359
Mulberry	OH	3323
Munroe Falls	OH	5019
Murray	OH	0
Murray City	OH	435
Mutual	OH	102
Nankin	OH	0
Napoleon	OH	8595
Nashport	OH	0
Nashville	OH	206
Navarre	OH	1922
Neapolis	OH	423
Neffs	OH	993
Negley	OH	281
Nellie	OH	132
Nelsonville	OH	5197
Nettle Lake	OH	0
Nevada	OH	740
Neville	OH	100
New Albany	OH	9879
New Alexandria	OH	264
New Athens	OH	321
New Baltimore	OH	661
New Bavaria	OH	98
New Bloomington	OH	496
New Boston	OH	2174
New Bremen	OH	2964
New Burlington	OH	5069
New California	OH	1411
New Carlisle	OH	5693
New Concord	OH	2343
New Franklin	OH	14275
New Hampshire	OH	174
New Haven	OH	583
New Holland	OH	836
New Knoxville	OH	867
New Lebanon	OH	4001
New Lexington	OH	4727
New London	OH	2381
New Madison	OH	878
New Marshfield	OH	326
New Matamoras	OH	1135
New Miami	OH	2316
New Middletown	OH	1576
New Paris	OH	1580
New Philadelphia	OH	17484
New Pittsburg	OH	388
New Richmond	OH	2642
New Riegel	OH	246
New Rome	OH	58
New Springfield	OH	0
New Straitsville	OH	715
New Vienna	OH	1202
New Washington	OH	936
New Waterford	OH	1202
New Weston	OH	134
Newark	OH	47986
Newburgh Heights	OH	2096
Newcomerstown	OH	3794
Newport	OH	1003
Newton Falls	OH	4654
Newtonsville	OH	393
Newtown	OH	2664
Ney	OH	353
Niles	OH	18651
North Baltimore	OH	3545
North Bend	OH	860
North Canton	OH	17441
North College Hill	OH	9332
North Fairfield	OH	537
North Fork Village	OH	1991
North Hampton	OH	472
North Industry	OH	0
North Kingsville	OH	2839
North Lawrence	OH	268
North Lewisburg	OH	1445
North Lima	OH	0
North Madison	OH	8547
North Olmsted	OH	32004
North Perry	OH	892
North Randall	OH	1007
North Ridgeville	OH	32483
North Robinson	OH	199
North Royalton	OH	30311
North Star	OH	232
North Zanesville	OH	2816
Northbrook	OH	10668
Northfield	OH	3637
Northgate	OH	7377
Northridge	OH	8487
Northwood	OH	5469
Norton	OH	12036
Norwalk	OH	16827
Norwich	OH	104
Norwood	OH	19915
Oak Harbor	OH	2715
Oak Hill	OH	1642
Oakwood	OH	9052
Oberlin	OH	8350
Obetz	OH	4761
Oceola	OH	190
Octa	OH	58
Ohio	OH	0
Ohio City	OH	747
Old Fort	OH	186
Old Washington	OH	275
Olde West Chester	OH	240
Olmsted Falls	OH	8889
Ontario	OH	6111
Orange	OH	3277
Orangeville	OH	197
Oregon	OH	20102
Orient	OH	270
Orrville	OH	8491
Orwell	OH	1609
Osgood	OH	297
Ostrander	OH	688
Ottawa	OH	4398
Ottawa Hills	OH	4443
Ottoville	OH	971
Otway	OH	84
Owensville	OH	814
Oxford	OH	22104
Painesville	OH	19776
Palestine	OH	197
Pancoastburg	OH	87
Pandora	OH	1149
Park Layne	OH	4343
Parkman	OH	0
Parma	OH	79937
Parma Heights	OH	20246
Parral	OH	220
Pataskala	OH	15245
Patterson	OH	138
Paulding	OH	3488
Payne	OH	1155
Peebles	OH	1764
Pekin	OH	0
Pemberville	OH	1423
Peninsula	OH	571
Pepper Pike	OH	6204
Perry	OH	1627
Perry Heights	OH	8441
Perrysburg	OH	21423
Perrysville	OH	723
Petersburg	OH	0
Pettisville	OH	498
Pheasant Run	OH	0
Phillipsburg	OH	554
Philo	OH	732
Pickerington	OH	19745
Pigeon Creek	OH	882
Piketon	OH	2146
Pioneer	OH	1401
Piqua	OH	20790
Pitsburg	OH	382
Plain	OH	0
Plain City	OH	4302
Plainfield	OH	168
Plainville	OH	87
Pleasant	OH	0
Pleasant City	OH	435
Pleasant Grove	OH	1742
Pleasant Hill	OH	1219
Pleasant Hills	OH	606
Pleasant Plain	OH	158
Pleasant Run	OH	4953
Pleasant Run Farm	OH	4654
Pleasantville	OH	958
Plumwood	OH	319
Plymouth	OH	1802
Poland	OH	2484
Polk	OH	339
Pomeroy	OH	1821
Port Clinton	OH	5957
Port Jefferson	OH	359
Port Washington	OH	570
Port William	OH	254
Portage	OH	451
Portage Lakes	OH	6968
Portsmouth	OH	20409
Potsdam	OH	293
Pottery Addition	OH	293
Powell	OH	12972
Powhatan Point	OH	1573
Proctorville	OH	559
Prospect	OH	1070
Pulaski	OH	132
Put-in-Bay	OH	136
Quaker	OH	0
Quaker City	OH	490
Quincy	OH	687
Racine	OH	662
Radnor	OH	201
Rarden	OH	154
Ravenna	OH	11619
Rawson	OH	577
Rayland	OH	404
Raymond	OH	257
Reading	OH	10324
Reedurban	OH	0
Reminderville	OH	3976
Remington	OH	328
Rendville	OH	36
Reno	OH	1293
Reno Beach	OH	0
Republic	OH	537
Reynoldsburg	OH	37158
Richfield	OH	3702
Richmond	OH	464
Richmond Dale	OH	377
Richmond Heights	OH	10469
Richville	OH	3324
Richwood	OH	2281
Ridgeville Corners	OH	435
Ridgeway	OH	335
Ridgewood	OH	0
Rio Grande	OH	854
Ripley	OH	1721
Risingsun	OH	628
Rittman	OH	6580
Riverlea	OH	569
Riverside	OH	24972
Roachester	OH	0
Roaming Shores	OH	1477
Robertsville	OH	331
Rochester	OH	181
Rock Creek	OH	515
Rockbridge	OH	182
Rockford	OH	1107
Rocky Fork Point	OH	639
Rocky Ridge	OH	409
Rocky River	OH	20376
Rogers	OH	233
Rome	OH	0
Rose Farm	OH	0
Roseland	OH	0
Rosemount	OH	2112
Roseville	OH	1853
Rosewood	OH	257
Ross	OH	3417
Rossburg	OH	221
Rossford	OH	6512
Rossmoyne	OH	2230
Roswell	OH	221
Rudolph	OH	458
Rushsylvania	OH	502
Rushville	OH	305
Russells Point	OH	1360
Russellville	OH	543
Russia	OH	656
Rutland	OH	381
Sabina	OH	2534
Saint Bernard	OH	4368
Saint Clairsville	OH	5184
Saint Henry	OH	2427
Saint Johns	OH	185
Saint Louisville	OH	373
Saint Martin	OH	129
Saint Marys	OH	8332
Saint Paris	OH	2089
Salem	OH	12003
Salem Heights	OH	3839
Salesville	OH	127
Salineville	OH	1273
Sandusky	OH	25212
Sandyville	OH	368
Sarahsville	OH	166
Sardinia	OH	957
Sardis	OH	559
Savannah	OH	408
Sawyerwood	OH	1540
Saybrook-on-the-Lake	OH	0
Scio	OH	742
Sciotodale	OH	1081
Scott	OH	281
Seaman	OH	924
Sebring	OH	4266
Senecaville	OH	445
Seven Hills	OH	11690
Seven Mile	OH	768
Seville	OH	2340
Shadyside	OH	3714
Shaker Heights	OH	27646
Sharon Center	OH	0
Sharonville	OH	13774
Shawnee	OH	646
Shawnee Hills	OH	2171
Sheffield	OH	3982
Sheffield Lake	OH	9026
Shelby	OH	9058
Sherrodsville	OH	296
Sherwood	OH	3719
Shiloh	OH	11272
Shreve	OH	1497
Sidney	OH	20858
Silver Lake	OH	2523
Silverton	OH	4764
Sinking Spring	OH	133
Sixteen Mile Stand	OH	2928
Skyline Acres	OH	1717
Smithfield	OH	835
Smithville	OH	1269
Solon	OH	23043
Somerset	OH	1464
Somerville	OH	286
South Amherst	OH	1668
South Bloomfield	OH	1851
South Canal	OH	1100
South Charleston	OH	1661
South Euclid	OH	21794
South Lebanon	OH	4346
South Middletown	OH	267
South Mount Vernon	OH	0
South Point	OH	3924
South Russell	OH	3826
South Salem	OH	208
South Solon	OH	361
South Vienna	OH	379
South Webster	OH	829
South Zanesville	OH	1989
Sparta	OH	163
Spencer	OH	764
Spencerville	OH	2200
Spring Valley	OH	486
Springboro	OH	18213
Springdale	OH	11182
Springfield	OH	59680
St. Bernard	OH	0
St. Clairsville	OH	0
St. Henry	OH	0
St. Johns	OH	0
St. Louisville	OH	0
St. Martin	OH	0
St. Marys	OH	0
St. Paris	OH	0
Stafford	OH	81
Sterling	OH	457
Steubenville	OH	18219
Stewart	OH	247
Stockdale	OH	135
Stockport	OH	489
Stone Creek	OH	179
Stony Prairie	OH	1284
Stony Ridge	OH	411
Stout	OH	97
Stoutsville	OH	566
Stow	OH	34797
Strasburg	OH	2679
Stratton	OH	277
Streetsboro	OH	16312
Strongsville	OH	44668
Struthers	OH	10375
Stryker	OH	1309
Suffield	OH	0
Sugar Bush Knolls	OH	174
Sugar Grove	OH	431
Sugarcreek	OH	2234
Sugarcreek Police Dept	OH	2220
Sullivan	OH	0
Sulphur Springs	OH	194
Summerfield	OH	243
Summerside	OH	5083
Summitville	OH	132
Sunbury	OH	5097
Swanton	OH	3886
Sycamore	OH	837
Sylvania	OH	18965
Syracuse	OH	821
Tallmadge	OH	17512
Tarlton	OH	290
Taylor Creek	OH	0
Tedrow	OH	173
Terrace Park	OH	2245
The Plains	OH	3080
The Village of Indian Hill	OH	5798
Thornport	OH	1004
Thornville	OH	997
Thurman	OH	133
Thurston	OH	610
Tiffin	OH	17687
Tiltonsville	OH	1320
Timberlake	OH	660
Tipp	OH	0
Tipp City	OH	9899
Tippecanoe	OH	121
Tiro	OH	273
Toledo	OH	265638
Tontogany	OH	384
Toronto	OH	4882
Tremont	OH	0
Tremont City	OH	370
Trenton	OH	12281
Trimble	OH	398
Trinway	OH	365
Trotwood	OH	24096
Troy	OH	25659
Tuppers Plains	OH	465
Turpin Hills	OH	5099
Tuscarawas	OH	1056
Twinsburg	OH	18872
Twinsburg Heights	OH	925
Uhrichsville	OH	5404
Union	OH	6461
Union City	OH	1620
Uniontown	OH	3309
Unionville Center	OH	239
Uniopolis	OH	221
University Heights	OH	13202
Upper Arlington	OH	34907
Upper Sandusky	OH	6527
Urbana	OH	11547
Urbancrest	OH	1033
Utica	OH	2196
Valley	OH	0
Valley Hi	OH	207
Valley View	OH	2012
Valleyview	OH	0
Van Buren	OH	376
Van Wert	OH	10798
Vandalia	OH	15106
Vanlue	OH	362
Vaughnsville	OH	262
Venedocia	OH	122
Vermilion	OH	10434
Vermilion-on-the-Lake	OH	11006
Verona	OH	486
Versailles	OH	2643
Vickery	OH	121
Vienna Center	OH	650
Vincent	OH	339
Vinton	OH	342
Wadsworth	OH	21860
Waite Hill	OH	465
Wakeman	OH	1032
Walbridge	OH	3109
Waldo	OH	325
Walnut Creek	OH	878
Walnut Hills	OH	6344
Walton Hills	OH	2245
Wapakoneta	OH	9823
Warren	OH	40245
Warrensville Heights	OH	13542
Warsaw	OH	674
Washington Court House	OH	14019
Washingtonville	OH	777
Waterford	OH	450
Waterville	OH	5514
Wauseon	OH	7316
Waverly	OH	4274
Wayne	OH	898
Wayne Lakes	OH	0
Wayne Lakes Park	OH	718
Waynesburg	OH	968
Waynesfield	OH	847
Waynesville	OH	2999
Wellington	OH	4852
Wellston	OH	5494
Wellsville	OH	3410
West Alexandria	OH	1341
West Carrollton	OH	0
West Carrollton City	OH	13297
West Elkton	OH	193
West Farmington	OH	487
West Hill	OH	2273
West Jefferson	OH	4279
West Lafayette	OH	2286
West Leipsic	OH	202
West Liberty	OH	1775
West Logan	OH	0
West Manchester	OH	465
West Mansfield	OH	667
West Millgrove	OH	178
West Milton	OH	4714
West Portsmouth	OH	3149
West Rushville	OH	135
West Salem	OH	1487
West Union	OH	3179
West Unity	OH	1645
Westerville	OH	38384
Westfield Center	OH	1134
Westlake	OH	32428
Westminster	OH	0
Weston	OH	1638
Wetherington	OH	1302
Wharton	OH	352
Wheelersburg	OH	6437
White Oak	OH	19167
Whitehall	OH	18694
Whitehouse	OH	4462
Whites Landing	OH	375
Wickliffe	OH	12545
Wightmans Grove	OH	72
Wilberforce	OH	2271
Wilkesville	OH	147
Wilkshire Hills	OH	0
Willard	OH	6063
Williamsburg	OH	2549
Williamsdale	OH	581
Williamsport	OH	1051
Williston	OH	487
Willoughby	OH	22631
Willoughby Hills	OH	9382
Willowick	OH	13957
Willshire	OH	387
Wilmington	OH	12449
Wilmot	OH	303
Wilson	OH	125
Winchester	OH	1035
Windham	OH	2205
Winesburg	OH	352
Wintersville	OH	3795
Withamsville	OH	7021
Wolfhurst	OH	1239
Woodlawn	OH	3292
Woodmere	OH	864
Woodsdale	OH	0
Woodsfield	OH	2348
Woodstock	OH	301
Woodville	OH	2083
Woodworth	OH	0
Wooster	OH	26749
Worthington	OH	14498
Wren	OH	192
Wright-Patterson AFB	OH	1821
Wyoming	OH	8411
Xenia	OH	25976
Yankee Lake	OH	77
Yellow Springs	OH	3793
Yorkshire	OH	94
Yorkville	OH	1044
Youngstown	OH	64628
Zaleski	OH	267
Zanesfield	OH	195
Zanesville	OH	25498
Zoar	OH	181
Achille	OK	510
Ada	OK	17303
Adair	OK	819
Adams	OK	0
Adamson	OK	0
Addington	OK	109
Afton	OK	1050
Agra	OK	346
Akins	OK	493
Albany	OK	143
Albion	OK	102
Alderson	OK	291
Alex	OK	554
Aline	OK	219
Allen	OK	935
Alluwe	OK	84
Altus	OK	19214
Alva	OK	5180
Amber	OK	454
Ames	OK	247
Amorita	OK	39
Anadarko	OK	6717
Antlers	OK	2354
Apache	OK	1430
Arapaho	OK	826
Arcadia	OK	256
Ardmore	OK	25176
Arkoma	OK	1925
Armstrong	OK	109
Arnett	OK	532
Arpelar	OK	272
Asher	OK	415
Ashland	OK	63
Atoka	OK	3065
Atwood	OK	72
Avant	OK	317
Avard	OK	24
Bache	OK	0
Badger Lee	OK	0
Baker	OK	0
Ballou	OK	176
Barber	OK	0
Barnsdall	OK	1209
Baron	OK	0
Bartlesville	OK	36595
Bearden	OK	132
Beaver	OK	1454
Bee	OK	140
Beggs	OK	1247
Belfonte	OK	394
Bell	OK	535
Bennington	OK	347
Bentley	OK	0
Bernice	OK	562
Bessie	OK	182
Bethany	OK	19589
Bethel Acres	OK	3101
Big Cabin	OK	262
Billings	OK	510
Binger	OK	654
Bison	OK	65
Bixby	OK	24657
Blackburn	OK	108
Blackgum	OK	51
Blackwell	OK	6875
Blair	OK	778
Blanchard	OK	8280
Blanco	OK	0
Blue	OK	195
Bluejacket	OK	335
Boise	OK	0
Boise City	OK	1127
Bokchito	OK	657
Bokoshe	OK	494
Boley	OK	1183
Boswell	OK	699
Bowlegs	OK	406
Bowring	OK	0
Box	OK	224
Boynton	OK	243
Bradley	OK	131
Braggs	OK	254
Braman	OK	212
Bray	OK	1193
Breckenridge	OK	0
Breckinridge	OK	245
Brent	OK	716
Briartown	OK	0
Bridge Creek	OK	335
Bridgeport	OK	110
Briggs	OK	303
Bristow	OK	4248
Broken Arrow	OK	106563
Broken Bow	OK	4131
Bromide	OK	166
Brooksville	OK	60
Brush Creek	OK	35
Brushy	OK	900
Bryant	OK	0
Buffalo	OK	1311
Bug Tussle	OK	0
Bull Hollow	OK	67
Bunch	OK	0
Burbank	OK	139
Burlington	OK	161
Burneyville	OK	0
Burns Flat	OK	2049
Bushyhead	OK	1314
Butler	OK	305
Byars	OK	262
Byng	OK	1191
Byron	OK	37
Cache	OK	2925
Caddo	OK	1048
Calera	OK	2247
Calumet	OK	564
Calvin	OK	285
Camargo	OK	186
Cameron	OK	293
Canadian	OK	207
Canadian Shores	OK	0
Caney	OK	198
Caney Ridge	OK	0
Canton	OK	615
Canute	OK	545
Capron	OK	23
Cardin (historical)	OK	3
Carlisle	OK	606
Carlton Landing	OK	0
Carmen	OK	367
Carnegie	OK	1700
Carney	OK	661
Carrier	OK	89
Carter	OK	266
Cartwright	OK	609
Cashion	OK	847
Castle	OK	106
Catoosa	OK	7146
Cave Spring	OK	0
Cayuga	OK	140
Cedar Crest	OK	312
Cedar Lake	OK	0
Cedar Valley	OK	317
Cement	OK	495
Centrahoma	OK	93
Central High	OK	1184
Chance	OK	0
Chandler	OK	3175
Chattanooga	OK	455
Checotah	OK	3261
Chelsea	OK	1969
Cherokee	OK	1560
Cherry Tree	OK	883
Chester	OK	117
Chewey	OK	135
Cheyenne	OK	824
Chickasha	OK	16488
Choctaw	OK	12179
Chouteau	OK	2092
Christie	OK	218
Cimarron	OK	0
Cimarron City	OK	165
Claremore	OK	18997
Clarita	OK	0
Clarksville	OK	0
Clayton	OK	795
Clearview	OK	48
Cleo Springs	OK	350
Cleora	OK	1463
Cleveland	OK	3216
Clinton	OK	9565
Cloud Creek	OK	121
Coalgate	OK	1867
Colbert	OK	1183
Colcord	OK	815
Cole	OK	570
Coleman	OK	0
Collinsville	OK	6492
Colony	OK	137
Comanche	OK	1625
Commerce	OK	2483
Connerville	OK	0
Cookson	OK	0
Cooperton	OK	16
Copan	OK	741
Copeland	OK	1629
Cordell	OK	2892
Corn	OK	506
Cornish	OK	158
Cottonwood	OK	0
Council Hill	OK	151
Covington	OK	554
Coweta	OK	9559
Cowlington	OK	155
Coyle	OK	357
Crescent	OK	1527
Crescent Springs	OK	0
Cromwell	OK	287
Crowder	OK	412
Cumberland	OK	0
Cushing	OK	7867
Custer	OK	0
Custer City	OK	399
Cyril	OK	1046
Dacoma	OK	114
Dale	OK	181
Davenport	OK	821
Davidson	OK	298
Davis	OK	2794
Deer Creek	OK	132
Deer Lick	OK	46
Del	OK	0
Del City	OK	22022
Delaware	OK	417
Dennis	OK	195
Depew	OK	482
Devol	OK	147
Dewar	OK	872
Dewey	OK	3499
Dibble	OK	827
Dickson	OK	1253
Dill	OK	0
Dill City	OK	566
Disney	OK	303
Dixon	OK	0
Dodge	OK	115
Dotyville	OK	101
Dougherty	OK	221
Douglas	OK	34
Dover	OK	473
Dripping Springs	OK	50
Drowning Creek	OK	0
Drummond	OK	473
Drumright	OK	2880
Dry Creek	OK	227
Duchess Landing	OK	114
Duke	OK	341
Duncan	OK	23231
Durant	OK	17286
Durham	OK	0
Dustin	OK	379
Dwight Mission	OK	55
Eagle	OK	0
Eagletown	OK	528
Eakly	OK	334
Earl	OK	0
Earlsboro	OK	639
East Duke	OK	0
Edgewater Park	OK	0
Edmond	OK	90092
El Reno	OK	18516
Eldon	OK	368
Eldorado	OK	428
Elgin	OK	2969
Elk	OK	0
Elk City	OK	12717
Elm Grove	OK	0
Elmer	OK	92
Elmore	OK	0
Elmore City	OK	706
Elohim	OK	0
Emet	OK	0
Empire	OK	0
Empire City	OK	923
Enid	OK	51776
Enterprise	OK	0
Erick	OK	1093
Erin Springs	OK	87
Etowah	OK	92
Etta	OK	0
Eufaula	OK	2936
Evening Shade	OK	359
Fair Oaks	OK	103
Fairfax	OK	1349
Fairfield	OK	584
Fairland	OK	1062
Fairmont	OK	141
Fairview	OK	2655
Fallis	OK	27
Fanshawe	OK	407
Fargo	OK	375
Faxon	OK	134
Fay	OK	0
Felt	OK	93
Finley	OK	0
Fittstown	OK	0
Fitzhugh	OK	232
Fletcher	OK	1169
Flint Creek	OK	732
Flute Springs	OK	130
Foraker	OK	19
Forest Park	OK	1074
Forgan	OK	529
Fort Cobb	OK	627
Fort Coffee	OK	413
Fort Gibson	OK	4083
Fort Supply	OK	352
Fort Towson	OK	499
Foss	OK	152
Foster	OK	162
Fox	OK	0
Foyil	OK	343
Francis	OK	318
Frederick	OK	3692
Freedom	OK	307
Friendship	OK	23
Gage	OK	443
Gans	OK	302
Garber	OK	852
Garvin	OK	251
Gate	OK	90
Geary	OK	1305
Gene Autry	OK	158
Geronimo	OK	1235
Gerty	OK	114
Gideon	OK	49
Glencoe	OK	606
Glenpool	OK	13225
Golden	OK	0
Goldsby	OK	2102
Goltry	OK	263
Goodwell	OK	1326
Gore	OK	944
Gotebo	OK	221
Gould	OK	134
Gowen	OK	0
Gracemont	OK	314
Grainola	OK	31
Grand Lake Towne	OK	73
Grandfield	OK	972
Grandview	OK	0
Granite	OK	2031
Grant	OK	289
Grayson	OK	156
Greasy	OK	372
Greenfield	OK	93
Greenville	OK	0
Gregory	OK	171
Grove	OK	6751
Guthrie	OK	11270
Guymon	OK	11921
Haileyville	OK	779
Hall Park	OK	1095
Hallett	OK	124
Hammon	OK	592
Hanna	OK	135
Hanson	OK	0
Hardesty	OK	222
Harrah	OK	5891
Hartshorne	OK	2017
Haskell	OK	1979
Hastings	OK	138
Haworth	OK	295
Haywood	OK	0
Headrick	OK	90
Healdton	OK	2776
Heavener	OK	3340
Helena	OK	1426
Hendrix	OK	82
Hennepin	OK	0
Hennessey	OK	2199
Henryetta	OK	5765
Hickory	OK	73
Hillsdale	OK	127
Hinton	OK	3244
Hitchcock	OK	121
Hitchita	OK	86
Hobart	OK	3621
Hochatown	OK	0
Hodgen	OK	0
Hoffman	OK	124
Holdenville	OK	5750
Hollis	OK	1967
Hollister	OK	47
Homestead	OK	0
Hominy	OK	3508
Honey Hill	OK	0
Hooker	OK	1996
Hoot Owl	OK	4
Hopeton	OK	0
Horntown	OK	94
Hough	OK	0
Howe	OK	791
Hoyt	OK	0
Hugo	OK	5224
Hulbert	OK	603
Hunter	OK	173
Hydro	OK	960
Idabel	OK	7007
Indiahoma	OK	341
Indianola	OK	155
Ingalls	OK	0
Inola	OK	1834
Iron Post	OK	120
Isabella	OK	136
IXL	OK	51
Jamestown	OK	10
Jay	OK	2483
Jefferson	OK	12
Jenks	OK	20740
Jennings	OK	358
Jet	OK	225
Johnson	OK	252
Johnson Prairie	OK	0
Jones	OK	2948
Justice	OK	1324
Kansas	OK	783
Katie	OK	351
Kaw	OK	0
Kaw City	OK	375
Keefton	OK	0
Kellyville	OK	1147
Kemp	OK	138
Kendrick	OK	142
Kenefic	OK	204
Kenton	OK	17
Kenwood	OK	1224
Keota	OK	564
Ketchum	OK	438
Keyes	OK	288
Keys	OK	565
Kiefer	OK	1920
Kildare	OK	98
Kingfisher	OK	4865
Kingston	OK	1632
Kinta	OK	297
Kiowa	OK	695
Knowles	OK	10
Konawa	OK	1290
Krebs	OK	1973
Kremlin	OK	268
Lahoma	OK	651
Lake Aluma	OK	88
Lake Ellsworth Addition	OK	0
Lakeside	OK	0
Lamar	OK	153
Lambert	OK	6
Lamont	OK	411
Lane	OK	414
Langley	OK	821
Langston	OK	1830
Latta	OK	0
Laverne	OK	1365
Lawrence Creek	OK	149
Lawton	OK	96655
Lawtonka Acres	OK	0
Le Flore	OK	0
Leach	OK	237
Lebanon	OK	303
Leedey	OK	453
Leflore	OK	190
Lehigh	OK	340
Lenapah	OK	293
Leon	OK	96
Leonard	OK	0
Lequire	OK	0
Lexington	OK	2161
Liberty	OK	220
Lima	OK	53
Limestone	OK	629
Lindsay	OK	2830
Little	OK	0
Little Ponderosa	OK	0
Little Rock	OK	0
Loco	OK	121
Locust Grove	OK	1406
Lone Chimney	OK	0
Lone Grove	OK	5213
Lone Wolf	OK	419
Long	OK	370
Longdale	OK	262
Longtown	OK	2739
Lookeba	OK	164
Lost	OK	0
Lost City	OK	767
Lotsee	OK	2
Loveland	OK	12
Lovell	OK	0
Lowrey	OK	0
Loyal	OK	81
Lucien	OK	88
Luther	OK	1541
Lyons Switch	OK	288
Macomb	OK	33
Madill	OK	3923
Mallard Bay	OK	0
Manchester	OK	103
Mangum	OK	2910
Manitou	OK	171
Mannford	OK	3121
Mannsville	OK	850
Maramec	OK	91
Marble	OK	0
Marble City	OK	252
Marietta	OK	2729
Marland	OK	226
Marlow	OK	4594
Marshall	OK	299
Martha	OK	157
Maud	OK	1076
May	OK	40
Maysville	OK	1231
Mazie	OK	91
McAlester	OK	18310
McBride	OK	84
McCord	OK	1440
McCurtain	OK	516
McKey	OK	135
McLoud	OK	4615
Mead	OK	127
Medford	OK	987
Medicine Park	OK	444
Meeker	OK	1172
Mehan	OK	0
Meno	OK	243
Meridian	OK	1493
Miami	OK	13611
Middleberg	OK	0
Midwest	OK	0
Midwest City	OK	57249
Milburn	OK	317
Milfay	OK	0
Mill Creek	OK	319
Millerton	OK	317
Minco	OK	1656
Moffett	OK	122
Monroe	OK	0
Moodys	OK	0
Moore	OK	60451
Mooreland	OK	1282
Morris	OK	1462
Morrison	OK	736
Mounds	OK	1177
Mountain Park	OK	399
Mountain View	OK	769
Moyers	OK	0
Mulberry	OK	0
Muldrow	OK	3282
Mule Barn	OK	0
Mulhall	OK	248
Murphy	OK	219
Muskogee	OK	38456
Mustang	OK	20226
Mutual	OK	65
Narcissa	OK	99
Nardin	OK	52
Nash	OK	204
Nashoba	OK	0
Nelagoney	OK	0
Nescatunga	OK	70
New Alluwe	OK	0
New Cordell	OK	0
New Eucha	OK	405
New Tulsa	OK	741
New Woodville	OK	132
Newcastle	OK	9438
Newkirk	OK	2253
Nichols Hills	OK	3887
Nicoma Park	OK	2469
Nicut	OK	360
Ninnekah	OK	1036
Noble	OK	6666
Norge	OK	149
Norman	OK	128026
North Enid	OK	925
North Miami	OK	382
Norwood	OK	0
Notchietown	OK	0
Notiechtown	OK	373
Nowata	OK	3743
Oak Grove	OK	18
Oak Hill-Piney	OK	0
Oakhurst	OK	2185
Oakland	OK	1073
Oaks	OK	285
Oakwood	OK	68
Ochelata	OK	428
Oilton	OK	1015
Okarche	OK	1307
Okay	OK	615
Okeene	OK	1213
Okemah	OK	3247
Oklahoma	OK	0
Oklahoma City	OK	681054
Okmulgee	OK	12244
Oktaha	OK	383
Old Eucha	OK	52
Old Green	OK	315
Olive	OK	0
Olustee	OK	583
Oologah	OK	1179
Optima	OK	376
Orlando	OK	163
Osage	OK	154
Owasso	OK	34542
Paden	OK	459
Panama	OK	1370
Panola	OK	0
Paoli	OK	614
Paradise Hill	OK	82
Park Hill	OK	3909
Pauls Valley	OK	6152
Pawhuska	OK	3605
Pawnee	OK	2160
Peavine	OK	423
Peckham	OK	0
Peggs	OK	813
Pensacola	OK	124
Peoria	OK	133
Perkins	OK	2857
Perry	OK	5097
Pershing	OK	0
Pettit	OK	954
Phillips	OK	129
Picher (historical)	OK	20
Pickett	OK	0
Piedmont	OK	7118
Pin Oak Acres	OK	421
Piney	OK	115
Pinhook Corner	OK	171
Pink	OK	2095
Pittsburg	OK	199
Platter	OK	0
Pocasset	OK	204
Pocola	OK	4031
Ponca	OK	0
Ponca City	OK	24758
Pond Creek	OK	866
Pontotoc	OK	0
Porter	OK	586
Porum	OK	714
Poteau	OK	8732
Prague	OK	2453
Preston	OK	0
Proctor	OK	231
Prue	OK	465
Pryor	OK	8708
Pryor Creek	OK	9469
Pump Back	OK	175
Pumpkin Hollow	OK	0
Purcell	OK	6370
Putnam	OK	30
Quapaw	OK	906
Quay	OK	44
Quinlan	OK	22
Quinton	OK	1009
Ralston	OK	328
Ramona	OK	545
Randlett	OK	425
Ratliff	OK	0
Ratliff City	OK	120
Rattan	OK	298
Ravia	OK	523
Reagan	OK	0
Red Bird	OK	154
Red Oak	OK	505
Red Rock	OK	284
Redbird	OK	0
Redbird Smith	OK	465
Remy	OK	562
Renfrow	OK	12
Rentiesville	OK	125
Reydon	OK	219
Ringling	OK	1002
Ringwood	OK	514
Ripley	OK	406
River Bottom	OK	154
Rock Island	OK	636
Rocky	OK	163
Rocky Ford	OK	62
Rocky Mountain	OK	420
Rocky Point	OK	0
Roff	OK	720
Roland	OK	3529
Roosevelt	OK	242
Rose	OK	285
Rosedale	OK	70
Rosston	OK	32
Rush Springs	OK	1275
Ryan	OK	789
Saint Louis	OK	158
Salem	OK	112
Salina	OK	1384
Sallisaw	OK	8596
Sams Corner	OK	137
Sand Hill	OK	395
Sand Point	OK	0
Sand Springs	OK	19783
Sapulpa	OK	20579
Sasakwa	OK	145
Savanna	OK	657
Sawyer	OK	317
Sayre	OK	4773
Schulter	OK	501
Scipio	OK	0
Scraper	OK	191
Seiling	OK	882
Selman	OK	0
Seminole	OK	7522
Sentinel	OK	907
Sequoyah	OK	698
Seward	OK	0
Shady Grove	OK	556
Shady Point	OK	997
Shamrock	OK	101
Sharon	OK	135
Shattuck	OK	1385
Shawnee	OK	31286
Shidler	OK	436
Short	OK	293
Silo	OK	348
Simms	OK	325
Skedee	OK	51
Skiatook	OK	7880
Slaughterville	OK	4217
Slick	OK	131
Smith	OK	0
Smith Village	OK	68
Smithville	OK	113
Snake Creek	OK	257
Snyder	OK	1345
Soper	OK	258
Sour John	OK	60
South Coffeyville	OK	772
Sparks	OK	173
Sparrowhawk	OK	0
Spaulding	OK	173
Spavinaw	OK	433
Spencer	OK	4027
Sperry	OK	1268
Spiro	OK	2167
Sportmans Shores	OK	0
Sportsmen Acres	OK	314
Springer	OK	702
St. Louis	OK	0
Steely Hollow	OK	0
Sterling	OK	803
Stidham	OK	20
Stigler	OK	2766
Stillwater	OK	48967
Stilwell	OK	4016
Stonewall	OK	474
Stoney Point	OK	238
Strang	OK	88
Stratford	OK	1535
Stringtown	OK	403
Strong	OK	0
Strong City	OK	49
Stroud	OK	2767
Stuart	OK	174
Sugden	OK	42
Sulphur	OK	5097
Summit	OK	137
Sumner	OK	0
Sunray	OK	0
Sweetwater	OK	91
Swink	OK	66
Sycamore	OK	177
Taft	OK	245
Tagg Flats	OK	13
Tahlequah	OK	16598
Talala	OK	276
Talihina	OK	1097
Taloga	OK	314
Tamaha	OK	176
Tatums	OK	151
Taylor Ferry	OK	0
Tecumseh	OK	6630
Temple	OK	969
Tenkiller	OK	390
Teresita	OK	159
Terlton	OK	107
Terral	OK	403
Texanna	OK	2261
Texhoma	OK	969
Texola	OK	38
Thackerville	OK	467
The	OK	0
The Village	OK	9400
Thomas	OK	1244
Tiawah	OK	189
Tipton	OK	794
Tishomingo	OK	3075
Titanic	OK	356
Tonkawa	OK	3126
Tonkawa Tribal Housing	OK	0
Toppers	OK	0
Tribbey	OK	400
Tryon	OK	502
Tullahassee	OK	107
Tulsa	OK	413066
Tupelo	OK	315
Turley	OK	2756
Turpin	OK	467
Tushka	OK	302
Tuskahoma	OK	151
Tuttle	OK	6805
Twin Lakes	OK	0
Twin Oaks	OK	198
Tyrone	OK	786
Union	OK	0
Union City	OK	1942
Utica	OK	0
Valley Brook	OK	781
Valley Park	OK	70
Valliant	OK	746
Vanoss	OK	0
Velma	OK	612
Vera	OK	247
Verden	OK	532
Verdigris	OK	4351
Vernon	OK	0
Vian	OK	1396
Vici	OK	726
Vinita	OK	5643
Wagoner	OK	8713
Wainwright	OK	162
Wakita	OK	344
Walters	OK	2502
Wanette	OK	356
Wann	OK	125
Wapanucka	OK	437
Wardville	OK	54
Warner	OK	1623
Warr Acres	OK	10431
Warwick	OK	151
Washington	OK	634
Washita	OK	0
Watonga	OK	3008
Watova	OK	0
Watts	OK	311
Wauhillau	OK	345
Waukomis	OK	1365
Waurika	OK	1988
Wayne	OK	706
Waynoka	OK	966
Weatherford	OK	12126
Webb	OK	0
Webb City	OK	61
Webbers Falls	OK	601
Welch	OK	611
Weleetka	OK	987
Welling	OK	771
Wellston	OK	795
Welty	OK	0
West Peavine	OK	218
West Siloam Springs	OK	840
Westport	OK	293
Westville	OK	1567
Wetumka	OK	1245
Wewoka	OK	3445
Whippoorwill	OK	0
White Eagle	OK	0
White Oak	OK	263
White Water	OK	80
Whitefield	OK	391
Whitehorn Cove	OK	0
Whitesboro	OK	250
Wickliffe	OK	75
Wilburton	OK	2683
Willow	OK	145
Wilson	OK	1730
Winchester	OK	506
Wister	OK	1069
Woodall	OK	823
Woodlawn Park	OK	153
Woodward	OK	12993
Wright	OK	0
Wright City	OK	745
Wyandotte	OK	333
Wynnewood	OK	2223
Wynona	OK	432
Yale	OK	1223
Yeager	OK	73
Yukon	OK	25892
Zeb	OK	497
Zena	OK	122
Zion	OK	41
Adair	OR	0
Adair Village	OR	818
Adams	OR	348
Adrian	OR	172
Agate Beach	OR	12351
Albany	OR	52175
Aloha	OR	49425
Alpine	OR	171
Alsea	OR	164
Altamont	OR	19257
Amity	OR	1641
Annex	OR	235
Antelope	OR	47
Arlington	OR	583
Ashland	OR	20861
Astoria	OR	9626
Athena	OR	1140
Aumsville	OR	4013
Aurora	OR	979
Baker	OR	0
Baker City	OR	9752
Bandon	OR	3115
Banks	OR	1934
Barlow	OR	139
Barnesdale	OR	0
Barview	OR	1844
Bay	OR	0
Bay City	OR	1332
Bayshore	OR	0
Bayside Gardens	OR	880
Beatty	OR	0
Beaver	OR	122
Beaver Marsh	OR	0
Beavercreek	OR	4485
Beaverton	OR	96577
Bellfountain	OR	75
Bend	OR	87014
Bethany	OR	20646
Biggs Junction	OR	22
Black Butte Ranch	OR	366
Blodgett	OR	58
Bly	OR	0
Boardman	OR	3354
Bonanza	OR	411
Boring	OR	0
Bridgeton	OR	593
Brogan	OR	90
Brookings	OR	6476
Brooks	OR	398
Brownsville	OR	1738
Bull Mountain	OR	0
Bunker Hill	OR	1444
Burns	OR	2757
Butte Falls	OR	433
Butteville	OR	265
Camp Sherman	OR	233
Canby	OR	17271
Cannon Beach	OR	1702
Canyon	OR	0
Canyon City	OR	672
Canyonville	OR	1911
Cape Meares	OR	99
Carlton	OR	2067
Cascade Locks	OR	1159
Cascadia	OR	147
Cave Junction	OR	1932
Cayuse	OR	59
Cedar Hills	OR	8300
Cedar Mill	OR	14546
Central Point	OR	17995
Chemult	OR	0
Chenoweth	OR	1855
Cherry Grove	OR	0
Cheshire	OR	0
Chiloquin	OR	721
Clackamas	OR	6767
Clatskanie	OR	1759
Cloverdale	OR	250
Coburg	OR	1055
Columbia	OR	0
Columbia City	OR	1958
Condon	OR	681
Coos Bay	OR	16182
Coquille	OR	3858
Cornelius	OR	12317
Corvallis	OR	55780
Cottage Grove	OR	9969
Cove	OR	554
Crabtree	OR	391
Crane	OR	129
Crawfordsville	OR	332
Crescent	OR	0
Crescent Lake	OR	0
Creswell	OR	5199
Crooked River Ranch	OR	0
Culp Creek	OR	2000
Culver	OR	1442
Dallas	OR	15277
Damascus	OR	10952
Days Creek	OR	272
Dayton	OR	2575
Dayville	OR	146
Deer Island	OR	294
Depoe Bay	OR	1422
Deschutes River Woods	OR	5077
Detroit	OR	216
Dexter	OR	0
Dillard	OR	478
Dilley	OR	0
Donald	OR	1001
Drain	OR	1157
Dufur	OR	623
Dundee	OR	3200
Dunes	OR	0
Dunes City	OR	1339
Dunthorpe	OR	0
Durham	OR	1938
Eagle Crest	OR	0
Eagle Point	OR	8902
Echo	OR	702
Elgin	OR	1732
Elkton	OR	199
Elmira	OR	0
Enterprise	OR	1893
Eola	OR	45
Estacada	OR	3152
Eugene	OR	176654
Fair Oaks	OR	278
Fairview	OR	9280
Falcon Heights	OR	0
Falls	OR	0
Falls City	OR	975
Florence	OR	8649
Foots Creek	OR	799
Forest Grove	OR	24457
Fort Hill	OR	129
Fort Klamath	OR	0
Fossil	OR	449
Four Corners	OR	15947
Fruitdale	OR	1177
Garden Home-Whitford	OR	6674
Gardiner	OR	248
Garibaldi	OR	783
Gaston	OR	688
Gates	OR	484
Gearhart	OR	1524
Gervais	OR	2631
Gilchrist	OR	0
Gladstone	OR	11986
Glasgow	OR	763
Glendale	OR	881
Glide	OR	1795
Gold Beach	OR	2279
Gold Hill	OR	1266
Gopher Flats	OR	379
Government Camp	OR	193
Grand Ronde	OR	1661
Granite	OR	37
Grants Pass	OR	37088
Grass Valley	OR	157
Green	OR	7515
Green Meadows	OR	0
Greenhorn	OR	0
Gresham	OR	110553
Haines	OR	418
Halfway	OR	291
Halsey	OR	942
Hammond	OR	589
Happy Valley	OR	18493
Harbor	OR	2391
Harper	OR	109
Harrisburg	OR	3704
Hayesville	OR	19936
Hebo	OR	232
Heceta Beach	OR	0
Helix	OR	182
Heppner	OR	1287
Hermiston	OR	17201
Hillsboro	OR	102347
Hines	OR	1525
Holley	OR	378
Hood River	OR	7624
Hubbard	OR	3299
Huntington	OR	437
Idanha	OR	134
Idaville	OR	337
Imbler	OR	306
Independence	OR	9227
Ione	OR	330
Irrigon	OR	1800
Island	OR	0
Island City	OR	1005
Jacksonville	OR	2883
Jasper	OR	0
Jeffers Garden	OR	368
Jeffers Gardens	OR	0
Jefferson	OR	3247
Jennings Lodge	OR	7315
John Day	OR	1680
Johnson	OR	0
Johnson City	OR	580
Jordan Valley	OR	174
Joseph	OR	1063
Junction	OR	0
Junction City	OR	5842
Juniper Canyon	OR	0
Juntura	OR	57
Keizer	OR	37895
Keno	OR	0
Kenton	OR	7000
Kerby	OR	595
King	OR	0
King City	OR	3680
Kings Valley	OR	65
Kirkpatrick	OR	179
Klamath Falls	OR	21399
Knappa	OR	0
La Grande	OR	13074
La Pine	OR	1777
Labish	OR	0
Labish Village	OR	412
Lacomb	OR	546
Lafayette	OR	3969
Lake Oswego	OR	38496
Lakeside	OR	1737
Lakeview	OR	2296
Langlois	OR	177
Lebanon	OR	16324
Lents	OR	20156
Lexington	OR	236
Lincoln	OR	0
Lincoln Beach	OR	2045
Lincoln City	OR	8536
Lonerock	OR	21
Long Creek	OR	192
Lookingglass	OR	855
Lostine	OR	209
Lowell	OR	1087
Lyons	OR	1187
Madras	OR	6662
Malin	OR	804
Manzanita	OR	622
Mapleton	OR	0
Marcola	OR	0
Marion	OR	313
Marlene	OR	0
Maupin	OR	430
Maywood Park	OR	778
McKay	OR	0
McMinnville	OR	33892
Meacham	OR	0
Medford	OR	79805
Mehama	OR	292
Melrose	OR	735
Merlin	OR	1615
Merrill	OR	825
Metolius	OR	743
Metzger	OR	3765
Mill	OR	0
Mill City	OR	1875
Millersburg	OR	1539
Milton-Freewater	OR	7035
Milwaukie	OR	20830
Mission	OR	1037
Mitchell	OR	121
Molalla	OR	8972
Monmouth	OR	10032
Monroe	OR	621
Monument	OR	125
Moro	OR	310
Mosier	OR	445
Mount Angel	OR	3437
Mount Hood	OR	286
Mount Hood Village	OR	4864
Mount Hood Villages	OR	0
Mount Vernon	OR	506
Mulino	OR	2103
Myrtle Creek	OR	3459
Myrtle Point	OR	2514
Neahkahnie	OR	192
Neahkahnie Beach	OR	192
Nehalem	OR	278
Neotsu	OR	0
Nesika Beach	OR	463
Neskowin	OR	134
Netarts	OR	748
New Hope	OR	1515
New Pine Creek	OR	120
Newberg	OR	22780
Newport	OR	10268
North Bend	OR	9673
North Plains	OR	2100
North Portland	OR	7000
North Powder	OR	436
Nyssa	OR	3175
O'Brien	OR	504
Oak Grove	OR	16629
Oak Hills	OR	11333
Oakland	OR	936
Oakridge	OR	3211
Oatfield	OR	13415
Oceanside	OR	361
Ochoco West	OR	0
Odell	OR	2255
Ontario	OR	10999
Oregon	OR	0
Oregon City	OR	35831
Oregon Shores	OR	0
Orient	OR	0
Pacific	OR	0
Pacific City	OR	1035
Paisley	OR	240
Parkdale	OR	311
Pendleton	OR	16881
Peoria	OR	94
Philomath	OR	4599
Phoenix	OR	4553
Pilot Rock	OR	1513
Pine Grove	OR	148
Pine Hollow	OR	494
Pistol River	OR	84
Pleasant Valley	OR	0
Plush	OR	57
Port Orford	OR	1146
Portland	OR	652503
Powers	OR	670
Prairie	OR	0
Prairie City	OR	880
Prescott	OR	49
Prineville	OR	9530
Prineville Lake Acres	OR	0
Pronghorn	OR	34
Prospect	OR	455
Rainier	OR	1920
Raleigh Hills	OR	5896
Redmond	OR	28654
Redwood	OR	2627
Reedsport	OR	4107
Rhododendron	OR	0
Richland	OR	176
Rickreall	OR	77
Riddle	OR	1191
River Point	OR	0
River Road	OR	0
Rivergrove	OR	289
Riverside	OR	201
Rockaway Beach	OR	1347
Rockcreek	OR	9316
Rocky Point	OR	0
Rogue River	OR	2227
Rose Lodge	OR	1894
Roseburg	OR	22114
Roseburg North	OR	5912
Rowena	OR	187
Ruch	OR	840
Rufus	OR	238
Running Y Ranch	OR	0
Saint Helens	OR	12883
Saint Paul	OR	421
Salem	OR	175535
San Marine	OR	0
Sandy	OR	10644
Santa Clara	OR	0
Saunders Lake	OR	0
Scappoose	OR	6954
Scio	OR	882
Scotts Mills	OR	367
Seaside	OR	6540
Selma	OR	695
Seneca	OR	193
Seventh Mountain	OR	0
Shady Cove	OR	2904
Shaniko	OR	37
Shedd	OR	204
Sheridan	OR	6094
Sherwood	OR	19283
Siletz	OR	1221
Silver Lake	OR	149
Silverton	OR	9753
Sisters	OR	2472
Sodaville	OR	308
South Lebanon	OR	1005
Sportsmans Park	OR	0
Sprague River	OR	0
Spray	OR	151
Springfield	OR	60870
St. Helens	OR	0
St. Paul	OR	0
Stafford	OR	1577
Stanfield	OR	2082
Stayton	OR	7969
Sublimity	OR	2870
Summerville	OR	134
Summit	OR	82
Sumpter	OR	203
Sunriver	OR	1393
Sutherlin	OR	7912
Svensen	OR	0
Sweet Home	OR	9270
Takilma	OR	378
Talent	OR	6411
Tangent	OR	1220
Terrebonne	OR	1257
Tetherow	OR	45
The Dalles	OR	15340
Three Rivers	OR	3014
Tigard	OR	51253
Tillamook	OR	4997
Toledo	OR	3511
Trail	OR	702
Trent	OR	0
Tri-City	OR	3931
Troutdale	OR	16631
Tualatin	OR	27154
Tumalo	OR	488
Turner	OR	1984
Tutuilla	OR	487
Tygh Valley	OR	206
Ukiah	OR	189
Umapine	OR	315
Umatilla	OR	7009
Umpqua	OR	112
Union	OR	2120
Unity	OR	127
Vale	OR	1833
Veneta	OR	4800
Vernonia	OR	2143
Waldport	OR	2130
Wallowa	OR	795
Wallowa Lake	OR	0
Wamic	OR	85
Wapanitia	OR	2
Warm Springs	OR	2945
Warren	OR	1787
Warrenton	OR	5282
Wasco	OR	389
Waterloo	OR	235
Wedderburn	OR	0
West Haven	OR	6009
West Haven-Sylvan	OR	8001
West Linn	OR	26593
West Scio	OR	120
West Slope	OR	6554
Westfir	OR	257
Weston	OR	647
Westport	OR	321
Wheeler	OR	419
White	OR	0
White City	OR	7975
Willamina	OR	2106
Williams	OR	1072
Wilsonville	OR	22729
Wimer	OR	678
Winchester Bay	OR	382
Winston	OR	5393
Wood	OR	0
Wood Village	OR	4017
Woodburn	OR	25173
Yachats	OR	718
Yamhill	OR	1094
Yoncalla	OR	1053
Aaronsburg	PA	613
Abbottstown	PA	1020
Abington	PA	55310
Academy Garden	PA	5437
Ackermanville	PA	610
Acme	PA	3833
Acosta	PA	0
Adamsburg	PA	169
Adamstown	PA	1840
Adamsville	PA	118
Addison	PA	201
Airville	PA	3100
Akron	PA	3993
Alba	PA	153
Albion	PA	1553
Albrightsville	PA	202
Alburtis	PA	2519
Aldan	PA	4165
Alexandria	PA	330
Alfarata	PA	149
Aliquippa	PA	9197
Allegheny West	PA	14249
Alleghenyville	PA	1134
Allen Lane	PA	3895
Allenport	PA	648
Allensville	PA	503
Allentown	PA	120207
Allenwood	PA	321
Allison	PA	625
Allison Park	PA	21552
Allport	PA	264
Almedia	PA	1078
Alsace Manor	PA	478
Altamont	PA	602
Altoona	PA	45344
Alum Bank	PA	218
Alverda	PA	0
Ambler	PA	6505
Ambridge	PA	6859
Ambridge Heights	PA	0
Amity Gardens	PA	3402
Ancient Oaks	PA	6661
Andalusia	PA	0
Andorra	PA	2619
Angora	PA	6413
Annville	PA	4767
Apollo	PA	1588
Applewold	PA	295
Arcadia University	PA	0
Archbald	PA	6960
Ardmore	PA	12455
Arendtsville	PA	961
Aristes	PA	311
Arlington Heights	PA	6333
Armagh	PA	118
Arnold	PA	4988
Arnold City	PA	498
Arnot	PA	332
Arona	PA	352
Ashland	PA	2734
Ashley	PA	2726
Ashville	PA	219
Aspers	PA	350
Aspinwall	PA	2763
Atglen	PA	1408
Athens	PA	3255
Atkinson Mills	PA	174
Atlantic	PA	77
Atlas	PA	809
Atlasburg	PA	401
Atwood	PA	105
Auburn	PA	722
Audubon	PA	8433
Austin	PA	550
Avalon	PA	4642
Avella	PA	804
Avis	PA	1508
Avoca	PA	2661
Avon	PA	1667
Avondale	PA	1399
Avonia	PA	1205
Avonmore	PA	982
Back Mountain	PA	26973
Baden	PA	4037
Baidland	PA	1563
Baileyville	PA	201
Bainbridge	PA	1355
Bairdford	PA	698
Bakerstown	PA	1761
Bala Cynwyd	PA	9299
Bald Eagle	PA	0
Baldwin	PA	19819
Bally	PA	1103
Bangor	PA	5203
Barkeyville	PA	203
Barnesboro	PA	2534
Barrville	PA	160
Bartram Village	PA	2564
Bath	PA	2667
Baumstown	PA	422
Beallsville	PA	450
Bear Creek	PA	0
Bear Creek Village	PA	259
Bear Lake	PA	160
Bear Rocks	PA	1048
Beaver	PA	4420
Beaver Falls	PA	8661
Beaver Meadows	PA	842
Beaver Springs	PA	674
Beaverdale	PA	1035
Beavertown	PA	973
Bechtelsville	PA	941
Bedford	PA	2742
Bedminster	PA	8402
Beech Creek	PA	700
Beech Mountain Lakes	PA	2022
Belfast	PA	1257
Bell Acres	PA	1395
Bell Road (historical)	PA	6137
Bella Vista	PA	6154
Belle Vernon	PA	1073
Bellefonte	PA	6248
Belleville	PA	1827
Bellevue	PA	8252
Bellwood	PA	1828
Belmont	PA	3526
Belsano	PA	0
Ben Avon	PA	1777
Ben Avon Heights	PA	376
Bendersville	PA	644
Bensalem	PA	60427
Benson	PA	185
Bentleyville	PA	2525
Benton	PA	831
Berlin	PA	2019
Bernville	PA	951
Berrysburg	PA	371
Berwick	PA	10223
Berwyn	PA	3631
Bessemer	PA	1072
Bethany	PA	235
Bethel	PA	499
Bethel Park	PA	32118
Bethlehem	PA	74892
Beurys Lake	PA	124
Big Bass Lake	PA	1270
Big Beaver	PA	1923
Big Run	PA	613
Bigler	PA	398
Biglerville	PA	1209
Birchwood Lakes	PA	1386
Bird in Hand	PA	402
Bird-in-Hand	PA	0
Birdsboro	PA	5159
Birmingham	PA	89
Black Lick	PA	1462
Blain	PA	262
Blaine Hill	PA	0
Blairsville	PA	3321
Blakely	PA	6334
Blanchard	PA	740
Blandburg	PA	402
Blandon	PA	7152
Blawnox	PA	1416
Bloomfield	PA	1095
Blooming Glen	PA	0
Blooming Valley	PA	331
Bloomsburg	PA	14585
Blossburg	PA	1516
Blue Ball	PA	1031
Blue Bell	PA	6067
Blue Grass	PA	6382
Blue Knob	PA	0
Blue Ridge Summit	PA	891
Boalsburg	PA	3722
Bobtown	PA	757
Boiling Springs	PA	3225
Bolivar	PA	446
Bonneauville	PA	1827
Boothwyn	PA	4933
Boston	PA	545
Boswell	PA	1224
Bowers	PA	326
Bowmanstown	PA	884
Bowmansville	PA	2077
Boyers	PA	0
Boyertown	PA	4046
Brackenridge	PA	3211
Braddock	PA	2128
Braddock Hills	PA	1861
Bradenville	PA	545
Bradford	PA	8507
Bradford Woods	PA	1171
Branch Dale	PA	388
Branchdale	PA	0
Brandonville	PA	197
Brave	PA	201
Breinigsville	PA	4138
Brentwood	PA	9512
Bressler	PA	1437
Brewerytown	PA	9291
Briar Creek	PA	681
Brickerville	PA	1309
Bridesburg	PA	6573
Bridgeport	PA	4564
Bridgeville	PA	5092
Bridgewater	PA	693
Brisbin	PA	396
Bristol	PA	9569
Brittany Farms-Highlands	PA	3695
Brittany Farms-The Highlands	PA	0
Broad Top	PA	0
Broad Top City	PA	441
Brockton	PA	0
Brockway	PA	2040
Brodheadsville	PA	1800
Brookhaven	PA	8078
Brooks Mill	PA	0
Brookville	PA	3868
Broomall	PA	10789
Browndale	PA	0
Brownstown	PA	2816
Brownsville	PA	2292
Browntown	PA	1418
Bruin	PA	505
Bryn Athyn	PA	1392
Bryn Mawr	PA	5009
Buck Run	PA	176
Buckhorn	PA	318
Buena Vista	PA	0
Buffington	PA	292
Bulger	PA	407
Bunola	PA	0
Burgettstown	PA	1352
Burlington	PA	152
Burnham	PA	2018
Burnside	PA	230
Burnt Cabins	PA	0
Bustleton	PA	32655
Butler	PA	13289
Byrnedale	PA	427
Cairnbrook	PA	520
California	PA	6608
Callensburg	PA	200
Callery	PA	390
Callimont	PA	40
Caln	PA	1519
Calumet	PA	1241
Cambridge	PA	0
Cambridge Springs	PA	2538
Camp Hill	PA	7923
Campbelltown	PA	3616
Canadensis	PA	2164
Canadohta Lake	PA	516
Canan Station	PA	0
Canoe Creek	PA	0
Canonsburg	PA	8922
Canton	PA	1920
Carbondale	PA	8566
Carlisle	PA	19143
Carlisle Barracks	PA	0
Carmichaels	PA	466
Carnegie	PA	7931
Carnot-Moon	PA	11372
Carpenter	PA	5300
Carroll Park	PA	11767
Carroll Valley	PA	3941
Carrolltown	PA	817
Carson Valley	PA	0
Casanova	PA	0
Cashtown	PA	459
Cassandra	PA	142
Casselman	PA	93
Cassville	PA	141
Castanea	PA	1125
Castle Shannon	PA	8235
Catasauqua	PA	6525
Catawissa	PA	1514
Cecil-Bishop	PA	2476
Cedar Crest	PA	0
Cedar Park	PA	8653
Cedarbrook	PA	12219
Cementon	PA	1538
Center City	PA	57239
Center Valley	PA	711
Centerport	PA	398
Centerville	PA	3191
Central	PA	0
Central City	PA	1073
Centralia	PA	5
Centre Hall	PA	1243
Cetronia	PA	2115
Chadds Ford	PA	0
Chalfant	PA	791
Chalfont	PA	4069
Chalkhill	PA	141
Chambersburg	PA	20691
Chapman	PA	199
Charleroi	PA	4015
Charlottsville	PA	0
Chase	PA	978
Cheltenham	PA	4810
Cherry Tree	PA	352
Cherry Valley	PA	65
Cherryville	PA	1580
Chest Springs	PA	144
Chester	PA	34092
Chester Heights	PA	2626
Chester Hill	PA	859
Chester Springs	PA	7520
Chesterbrook	PA	4589
Chestnut Hill	PA	9710
Cheswick	PA	1730
Chevy Chase Heights	PA	1502
Chewton	PA	488
Cheyney University	PA	0
Chicora	PA	1006
Chinatown	PA	1776
Chinchilla	PA	2098
Christiana	PA	1171
Church Hill	PA	1627
Churchill	PA	2979
Churchtown	PA	470
Churchville	PA	4128
Clairton	PA	6681
Clappertown	PA	0
Clarence	PA	626
Clarendon	PA	443
Clarion	PA	6089
Clark	PA	630
Clarks Green	PA	1476
Clarks Summit	PA	4950
Clarksville	PA	231
Clay	PA	1559
Claysburg	PA	1625
Claysville	PA	810
Clearfield	PA	6030
Clearville	PA	0
Cleona	PA	2135
Clifton Heights	PA	6684
Clinton	PA	434
Clintondale	PA	0
Clintonville	PA	486
Clymer	PA	1315
Coal Center	PA	138
Coaldale	PA	2197
Coalmont	PA	105
Coalport	PA	507
Coatesville	PA	13148
Cobbs Creek	PA	33373
Coburn	PA	236
Cochranton	PA	1109
Cochranville	PA	668
Cokeburg	PA	618
Collegeville	PA	5287
Collingdale	PA	8792
Collinsburg	PA	1125
Colonial Park	PA	13229
Colony Park	PA	1076
Columbia	PA	10388
Columbia Cross Roads	PA	600
Columbus	PA	824
Colver	PA	959
Colwyn	PA	2553
Commodore	PA	331
Conashaugh Lakes	PA	1294
Conemaugh	PA	1350
Conestoga	PA	1258
Confluence	PA	749
Conneaut Lake	PA	635
Conneaut Lakeshore	PA	2395
Conneautville	PA	751
Connellsville	PA	7515
Connoquenessing	PA	618
Conshohocken	PA	7956
Continental Courts	PA	0
Conway	PA	2150
Conyngham	PA	1881
Coopersburg	PA	2421
Cooperstown	PA	436
Coplay	PA	3229
Coral	PA	325
Coraopolis	PA	5590
Cornwall	PA	4226
Cornwells Heights	PA	1391
Corry	PA	6420
Corsica	PA	351
Cotton	PA	0
Coudersport	PA	2482
Coulter	PA	0
Courtdale	PA	735
Cove Forge	PA	0
Crabtree	PA	277
Crafton	PA	5876
Cranberry Township	PA	28098
Cranesville	PA	614
Creekside	PA	309
Crenshaw	PA	468
Cresco	PA	4240
Cresson	PA	1633
Cressona	PA	1625
Cross Creek	PA	137
Cross Keys	PA	0
Cross Roads	PA	514
Crown	PA	183
Croydon	PA	9950
Crucible	PA	725
Culp	PA	0
Cumbola	PA	443
Curryville	PA	0
Curtisville	PA	1064
Curwensville	PA	2474
Daisytown	PA	315
Dale	PA	1174
Dallas	PA	2783
Dallastown	PA	4017
Dalmatia	PA	488
Dalton	PA	1209
Danville	PA	4689
Darby	PA	10687
Darlington	PA	280
Dauberville	PA	848
Dauphin	PA	791
Davidsville	PA	1130
Dawson	PA	367
Dayton	PA	530
Deemston	PA	716
Deer Lake	PA	673
Defiance	PA	239
Delano	PA	342
Delaware Water Gap	PA	713
Delmont	PA	2640
Delta	PA	724
Denver	PA	3875
Derry	PA	2594
DeSales University	PA	0
Devon	PA	1515
Dewart	PA	1471
Dickson	PA	0
Dickson City	PA	5877
Dicksonville	PA	467
Dillsburg	PA	2569
Dilworthtown	PA	0
Distant	PA	0
Dixonville	PA	0
Donaldson	PA	328
Donegal	PA	119
Donora	PA	4663
Dormont	PA	8465
Dorneyville	PA	4406
Dorseyville	PA	0
Douglassville	PA	448
Dover	PA	1991
Downingtown	PA	7946
Doylestown	PA	8301
Dravosburg	PA	1763
Dresher	PA	5610
Drexel Hill	PA	28043
Drifting	PA	0
Driftwood	PA	63
Dry Tavern	PA	697
Dryville	PA	398
Dublin	PA	2169
DuBois	PA	7597
Duboistown	PA	1208
Dudley	PA	186
Dumb Hundred	PA	0
Dunbar	PA	1018
Duncannon	PA	1487
Duncansville	PA	1204
Dunlevy	PA	381
Dunlo	PA	342
Dunmore	PA	13379
Dunnstown	PA	1360
Dupont	PA	2714
Duquesne	PA	5535
Duryea	PA	4933
Dushore	PA	592
Eagle	PA	0
Eagle Creek	PA	0
Eagle Lake	PA	12
Eagles Mere	PA	118
Eagleview	PA	1644
Eagleville	PA	4800
Earlston	PA	1122
East Altoona	PA	0
East Bangor	PA	1566
East Berlin	PA	1534
East Berwick	PA	2007
East Brady	PA	911
East Butler	PA	706
East Conemaugh	PA	1159
East Earl	PA	1144
East Falls	PA	9631
East Freedom	PA	972
East Greenville	PA	2985
East Lansdowne	PA	2665
East Marianna	PA	0
East McKeesport	PA	2108
East Mount Airy	PA	18516
East Norriton	PA	13590
East Oak Lane	PA	9941
East Petersburg	PA	4525
East Pittsburgh	PA	1794
East Prospect	PA	936
East Rochester	PA	550
East Rutherford	PA	196
East Salem	PA	186
East Sharpsburg	PA	0
East Side	PA	303
East Smithfield	PA	0
East Stroudsburg	PA	10140
East Uniontown	PA	2419
East Vandergrift	PA	652
East Washington	PA	1966
East Waterford	PA	0
East York	PA	8777
Eastlawn Gardens	PA	3307
Easton	PA	26915
Eastvale	PA	222
Eastwick	PA	5398
Eau Claire	PA	299
Ebensburg	PA	3203
Economy	PA	9363
Eddington	PA	1906
Eddystone	PA	2407
Edenborn	PA	294
Edenburg	PA	681
Edgewood	PA	3069
Edgeworth	PA	1670
Edie	PA	83
Edinboro	PA	6335
Edinburg	PA	0
Edwardsville	PA	4732
Effort	PA	2269
Egypt	PA	2391
Ehrenfeld	PA	220
Eighty Four	PA	657
Elberta	PA	0
Elco	PA	323
Elderton	PA	348
Eldorado	PA	0
Eldred	PA	808
Elgin	PA	214
Elim	PA	3727
Elizabeth	PA	1499
Elizabethtown	PA	11586
Elizabethville	PA	1493
Elk Grove	PA	0
Elkins Park	PA	6901
Elkland	PA	1779
Ellport	PA	1141
Ellsworth	PA	998
Ellwood	PA	0
Ellwood City	PA	7617
Elmora	PA	0
Elmwood	PA	16988
Elrama	PA	307
Elverson	PA	1314
Elysburg	PA	2194
Emeigh	PA	0
Emerald Lakes	PA	2886
Emigsville	PA	2672
Emlenton	PA	600
Emmaus	PA	11368
Emporium	PA	1934
Emsworth	PA	2419
Englewood	PA	532
Enhaut	PA	1007
Enlow	PA	1013
Enola	PA	6111
Enon Valley	PA	298
Ephrata	PA	13861
Erie	PA	99475
Ernest	PA	448
Espy	PA	1642
Etna	PA	3401
Evans	PA	0
Evans City	PA	1773
Evansburg	PA	2129
Everett	PA	1759
Everson	PA	779
Exeter	PA	5596
Export	PA	883
Exton	PA	4842
Eyers Grove	PA	105
Factoryville	PA	1215
Fairchance	PA	1932
Fairdale	PA	2059
Fairfield	PA	509
Fairhope	PA	1151
Fairless Hills	PA	8466
Fairmount	PA	9246
Fairview	PA	2348
Fairview-Ferndale	PA	2139
Falls Creek	PA	1019
Fallston	PA	258
Falmouth	PA	420
Farmersville	PA	991
Farmington	PA	767
Farrell	PA	4792
Farwell	PA	0
Fawn Grove	PA	456
Fawn Lake Forest	PA	755
Faxon	PA	1395
Fayette	PA	0
Fayette City	PA	585
Fayetteville	PA	3128
Feasterville	PA	3074
Fellsburg	PA	1180
Felton	PA	505
Fenelton	PA	0
Ferndale	PA	1558
Fernville	PA	556
Fernway	PA	12414
Finleyville	PA	448
Fisherville	PA	0
Fishtown	PA	16307
Fivepointville	PA	1156
Fleetwood	PA	4085
Flemington	PA	1339
Flinton	PA	0
Floradale	PA	38
Flourtown	PA	4538
Flying Hills	PA	2568
Folcroft	PA	6637
Folsom	PA	8323
Foot of Ten	PA	672
Force	PA	253
Ford	PA	0
Ford City	PA	2878
Ford Cliff	PA	361
Forest	PA	0
Forest City	PA	1809
Forest Hills	PA	6443
Forest Lake	PA	0
Forestville	PA	435
Forksville	PA	144
Fort Fetter	PA	0
Fort Indiantown Gap	PA	143
Fort Loudon	PA	886
Fort Washington	PA	5446
Forty Fort	PA	4126
Foster Brook	PA	1251
Fostoria	PA	0
Foundryville	PA	256
Fountain Hill	PA	4629
Fountain Springs	PA	278
Fox Chapel	PA	5383
Fox Chase	PA	19730
Fox Run	PA	3282
Foxburg	PA	179
Frackville	PA	3729
Frankford	PA	23503
Frankfort Springs	PA	131
Franklin	PA	6302
Franklin Forge	PA	0
Franklin Park	PA	14415
Franklintown	PA	490
Frankstown	PA	0
Frazer	PA	0
Fredericksburg	PA	1357
Fredericktown	PA	403
Fredonia	PA	482
Freeburg	PA	575
Freedom	PA	1529
Freeland	PA	3460
Freemansburg	PA	2616
Freeport	PA	1743
Frenchville	PA	0
Friedens	PA	1523
Friedensburg	PA	858
Friendsville	PA	106
Friesville	PA	0
Frisco	PA	0
Frizzleburg	PA	602
Frystown	PA	380
Fullerton	PA	14925
Galeton	PA	1124
Gallitzin	PA	1605
Ganister	PA	0
Gap	PA	1931
Garden Court	PA	2902
Garden View	PA	2503
Gardners	PA	150
Garrett	PA	436
Gastonville	PA	2818
Geeseytown	PA	0
Geistown	PA	2371
Genesee	PA	0
Geneva	PA	109
Georgetown	PA	1640
Germantown	PA	10688
Gettysburg	PA	7608
Gibraltar	PA	680
Gibsonia	PA	2733
Gilberton	PA	751
Gilbertsville	PA	4832
Girard	PA	3023
Girard Estate	PA	11259
Girardville	PA	1486
Glasgow	PA	59
Glassport	PA	4420
Glen Campbell	PA	239
Glen Hope	PA	140
Glen Lyon	PA	1873
Glen Osborne	PA	0
Glen Richey	PA	0
Glen Rock	PA	2031
Glen Willow	PA	5012
Glenburn	PA	953
Glendale	PA	0
Glendon	PA	440
Glenfield	PA	214
Glenmoore	PA	0
Glenolden	PA	7173
Glenshaw	PA	8981
Glenside	PA	8384
Gold Key Lake	PA	1830
Goldsboro	PA	938
Goodville	PA	482
Gordon	PA	747
Gordonville	PA	508
Gouglersville	PA	548
Gouldsboro	PA	890
Graceton	PA	257
Grampian	PA	342
Grantley	PA	3628
Granville	PA	440
Grapeville	PA	538
Grassflat	PA	511
Gratz	PA	754
Gray	PA	0
Grays Ferry	PA	14838
Grazierville	PA	665
Great Bend	PA	694
Green Hills	PA	29
Green Lane	PA	500
Green Tree	PA	4968
Greencastle	PA	4043
Greenfields	PA	1170
Greenock	PA	2195
Greens Landing	PA	0
Greensboro	PA	258
Greensburg	PA	14495
Greenville	PA	5819
Greenwood	PA	2458
Grier	PA	0
Grier City	PA	241
Grill	PA	1468
Grindstone	PA	498
Grove	PA	0
Grove City	PA	8193
Guilford	PA	2138
Guilford Siding	PA	1939
Guys Mills	PA	124
Haddington	PA	20073
Halfway House	PA	2881
Halifax	PA	833
Hallam	PA	2665
Hallstead	PA	1246
Hamburg	PA	4398
Hamorton	PA	0
Hampton	PA	632
Hannasville	PA	176
Hanover	PA	15496
Harford	PA	0
Harlansburg	PA	0
Harleigh	PA	1104
Harleysville	PA	9286
Harmonsburg	PA	401
Harmony	PA	865
Harrisburg	PA	50183
Harrison	PA	0
Harrison City	PA	134
Harrisville	PA	880
Hartleton	PA	285
Hartranft	PA	19748
Hartstown	PA	201
Harveys Lake	PA	2791
Harwick	PA	899
Hasson Heights	PA	1351
Hastings	PA	1224
Hatboro	PA	7411
Hatfield	PA	3306
Haverford College	PA	0
Havertown	PA	50430
Hawk Run	PA	534
Hawley	PA	1152
Hawthorn	PA	469
Hawthorne	PA	2377
Haysville	PA	73
Hayti	PA	0
Hazen	PA	0
Hazleton	PA	24825
Hebron	PA	1305
Heckscherville	PA	220
Hegins	PA	812
Heidelberg	PA	1231
Heidlersburg	PA	707
Heilwood	PA	711
Hellertown	PA	5824
Hemlock Farms	PA	3271
Hendersonville	PA	325
Henrietta	PA	0
Hereford	PA	930
Herminie	PA	789
Hermitage	PA	16028
Herndon	PA	307
Hershey	PA	14257
Hickory	PA	740
Hickory Hills	PA	562
Highland Park	PA	1380
Highspire	PA	2378
Hilldale	PA	1246
Hiller	PA	1155
Hillsville	PA	0
Hinkletown	PA	0
Hokendauqua	PA	3378
Holiday Pocono	PA	476
Hollidaysburg	PA	5784
Holmesburg	PA	28046
Holters Crossing	PA	0
Homeacre-Lyndora	PA	6906
Homer	PA	0
Homer City	PA	1652
Homestead	PA	3114
Hometown	PA	1349
Homewood	PA	108
Homewood at Martinsburg	PA	0
Honesdale	PA	4233
Honey Brook	PA	1758
Hookstown	PA	145
Hooversville	PA	618
Hop Bottom	PA	312
Hopeland	PA	738
Hopewell	PA	245
Hopwood	PA	2090
Horsham	PA	14842
Hostetter	PA	740
Houserville	PA	1814
Houston	PA	1266
Houtzdale	PA	775
Howard	PA	722
Hublersburg	PA	104
Hudson	PA	1443
Hughestown	PA	1397
Hughesville	PA	2099
Hulmeville	PA	996
Hummels Wharf	PA	1353
Hummelstown	PA	4561
Hunker	PA	290
Hunterstown	PA	547
Hunting Park	PA	17682
Huntingdon	PA	7029
Hustontown	PA	0
Hyde	PA	1399
Hyde Park	PA	2528
Hydetown	PA	517
Hyndman	PA	910
Hyner	PA	0
Ickesburg	PA	0
Idaville	PA	177
Imperial	PA	2541
Indian Lake	PA	389
Indian Mountain Lake	PA	4372
Indian Rocks	PA	0
Indiana	PA	14100
Industry	PA	1846
Ingram	PA	3281
Inkerman	PA	1819
Intercourse	PA	1274
Iola	PA	144
Ironville	PA	0
Irvona	PA	625
Irwin	PA	3859
Ivyland	PA	1053
Jackson Center	PA	219
Jacksonville	PA	637
Jacksonwald	PA	3393
Jacobus	PA	1848
James	PA	0
James City	PA	287
Jamestown	PA	595
Jamison	PA	0
Jamison City	PA	134
Jeannette	PA	9335
Jeddo	PA	97
Jefferson	PA	737
Jefferson Hills	PA	11360
Jenkintown	PA	4431
Jennerstown	PA	669
Jermyn	PA	2096
Jerome	PA	1017
Jersey Shore	PA	4279
Jerseytown	PA	184
Jessup	PA	4495
Jim Thorpe	PA	4641
Joffre	PA	536
Johnsonburg	PA	2818
Johnstown	PA	19966
Jonestown	PA	1958
Jugtown	PA	0
Julian	PA	152
Juniata Gap	PA	0
Juniata Park	PA	17643
Juniata Terrace	PA	540
Kane	PA	3610
Kapp Heights	PA	863
Karns	PA	0
Karns City	PA	209
Karthaus	PA	0
Kelayres	PA	533
Kempton	PA	169
Kenhorst	PA	2867
Kenilworth	PA	1907
Kenmar	PA	4124
Kennedy Township	PA	8701
Kennerdell	PA	247
Kennett Square	PA	6167
Kensington	PA	5590
Kerrtown	PA	305
Kersey	PA	937
Kimberton	PA	0
King of Prussia	PA	19936
Kingsessing	PA	19668
Kingston	PA	12941
Kirkwood	PA	396
Kiskimere	PA	136
Kistler	PA	321
Kittanning	PA	3885
Klahr	PA	0
Klingerstown	PA	127
Knox	PA	1100
Knoxville	PA	622
Koppel	PA	743
Kratzerville	PA	383
Kreamer	PA	822
Kulpmont	PA	2851
Kulpsville	PA	8194
Kutztown	PA	5028
Kutztown University	PA	0
Kylertown	PA	340
Laboratory	PA	0
Laceyville	PA	364
Lafayette Hill	PA	2150
Laflin	PA	1479
Lake	PA	0
Lake Arthur Estates	PA	594
Lake City	PA	2965
Lake Heritage	PA	1333
Lake Latonka	PA	1012
Lake Meade	PA	2563
Lake Wallenpaupack Estates	PA	0
Lake Winola	PA	748
Lake Wynonah	PA	2640
Lakemont	PA	1868
Lakeside	PA	0
Lamar	PA	562
Lampeter	PA	1669
Lancaster	PA	59339
Landenberg	PA	11757
Landingville	PA	155
Landisburg	PA	218
Landisville	PA	1893
Lanesboro	PA	479
Langeloth	PA	717
Langhorne	PA	1599
Langhorne Manor	PA	1431
Lansdale	PA	16512
Lansdowne	PA	10639
Lanse	PA	0
Lansford	PA	3798
Laporte	PA	307
Larke	PA	0
Larksville	PA	4448
Latrobe	PA	8081
Lattimer	PA	554
Laurel Lake	PA	0
Laurel Mountain	PA	0
Laurel Mountain Park	PA	167
Laurel Run	PA	504
Laureldale	PA	3883
Laurelton	PA	221
Laurys Station	PA	1243
Lavelle	PA	742
Lawndale	PA	24134
Lawnton	PA	3813
Lawrence	PA	540
Lawrence Park	PA	3982
Lawrenceville	PA	638
Lawson Heights	PA	2194
Le Raysville	PA	285
Leamersville	PA	0
Lebanon	PA	25534
Lebanon South	PA	2270
Leechburg	PA	2069
Leeper	PA	158
Leesport	PA	1883
Leetsdale	PA	1199
Lehighton	PA	5314
Leith-Hatfield	PA	2546
Lemont	PA	2270
Lemont Furnace	PA	827
Lemoyne	PA	4636
Lenape Heights	PA	1167
Lenhartsville	PA	167
Lenkerville	PA	550
Leola	PA	7214
LeRaysville	PA	0
Level Green	PA	4020
Levittown	PA	52983
Lewis Run	PA	596
Lewisberry	PA	363
Lewisburg	PA	5774
Lewistown	PA	8271
Lexington Park	PA	4244
Liberty	PA	2520
Light Street	PA	1093
Lightstreet	PA	0
Ligonier	PA	1540
Lilly	PA	929
Lima	PA	2735
Lime Ridge	PA	890
Limerick	PA	18074
Lincoln	PA	1061
Lincoln Park	PA	1615
Lincoln University	PA	0
Lincolnville	PA	96
Linds Crossing	PA	0
Linesville	PA	997
Linglestown	PA	6334
Linntown	PA	1489
Linwood	PA	3281
Lionville	PA	6189
Lititz	PA	9225
Little Britain	PA	372
Little Meadows	PA	262
Littlestown	PA	4478
Liverpool	PA	962
Llewellyn	PA	0
Lock Haven	PA	9604
Locust Gap	PA	0
Locustdale	PA	177
Logan	PA	21926
Logan Square	PA	11213
Loganton	PA	470
Loganville	PA	1232
Long Branch	PA	434
Longfellow	PA	215
Loop	PA	0
Lorain	PA	723
Lorane	PA	4236
Loretto	PA	1376
Lower Allen	PA	6694
Lower Burrell	PA	11761
Lower Moyamensing	PA	16481
Loyalhanna	PA	3428
Loysville	PA	0
Lucerne Mines	PA	937
Ludlow	PA	2060
Lumber	PA	0
Lumber City	PA	255
Luthersburg	PA	0
Luzerne	PA	2850
Lykens	PA	1759
Lynnwood-Pricedale	PA	2031
Lyons	PA	472
Mackeyville	PA	0
Macungie	PA	3134
Madera	PA	0
Madison	PA	379
Madisonburg	PA	168
Mahaffey	PA	353
Mahanoy	PA	0
Mahanoy City	PA	4070
Mainesburg	PA	0
Mainville	PA	132
Maitland	PA	357
Malvern	PA	3430
Mammoth	PA	525
Manayunk	PA	4341
Manchester	PA	2753
Manheim	PA	4870
Manns Choice	PA	296
Manor	PA	3299
Manorville	PA	394
Mansfield	PA	3432
Mantua	PA	6829
Maple Glen	PA	7635
Mapleton	PA	427
Mapletown	PA	130
Marcus Hook	PA	2397
Marianna	PA	479
Marianne	PA	1167
Marienville	PA	3137
Marietta	PA	2608
Marion	PA	953
Marion Center	PA	429
Marion Heights	PA	605
Marklesburg	PA	202
Markleysburg	PA	278
Marlin	PA	661
Mars	PA	1658
Marshallton	PA	1441
Martins Creek	PA	631
Martinsburg	PA	1911
Martinsburg Junction	PA	0
Maryd	PA	0
Marysville	PA	2535
Masontown	PA	3399
Masthope	PA	685
Matamoras	PA	2603
Mather	PA	737
Mattawana	PA	276
Maxatawny	PA	0
Mayfield	PA	1737
Maytown	PA	3824
McAdoo	PA	2205
McAlisterville	PA	971
McClure	PA	942
McConnellsburg	PA	1048
McConnellstown	PA	1194
McDonald	PA	2095
McElhattan	PA	598
McEwensville	PA	278
McGovern	PA	2742
McKean	PA	0
McKeansburg	PA	163
McKee	PA	0
McKees Rocks	PA	6010
McKeesport	PA	19453
McKinley	PA	0
McKnightstown	PA	226
McMurray	PA	4647
McSherrystown	PA	3067
McVeytown	PA	333
Meadow Lands	PA	822
Meadowlands	PA	0
Meadowood	PA	2693
Meadville	PA	13061
Mechanicsburg	PA	8999
Mechanicsville	PA	3099
Media	PA	5363
Mehoopany	PA	0
Melrose Park	PA	0
Mercer	PA	1936
Mercersburg	PA	1558
Meridian	PA	3881
Merion Station	PA	0
Mermaid	PA	4854
Mertztown	PA	664
Meshoppen	PA	555
Messiah College	PA	0
Mexico	PA	472
Meyersdale	PA	2082
Middleboro	PA	388
Middleburg	PA	1314
Middleport	PA	395
Middletown	PA	9117
Midland	PA	2944
Midway	PA	2125
Mifflin	PA	628
Mifflinburg	PA	3520
Mifflintown	PA	926
Mifflinville	PA	1253
Mildred	PA	0
Milesburg	PA	1100
Milford	PA	1222
Milford Square	PA	897
Mill	PA	0
Mill Creek	PA	8324
Mill Hall	PA	1615
Mill Run	PA	0
Mill Village	PA	392
Millbourne	PA	1162
Millersburg	PA	2536
Millerstown	PA	675
Millersville	PA	8420
Millerton	PA	316
Millheim	PA	889
Millsboro	PA	666
Millvale	PA	3689
Millville	PA	956
Millwood	PA	566
Milroy	PA	1498
Milton	PA	6928
Mineral Springs	PA	0
Minersville	PA	4258
Mingoville	PA	503
Misericordia University	PA	0
Mocanaqua	PA	646
Modena	PA	528
Modena Park	PA	10882
Mohnton	PA	3036
Mohrsville	PA	383
Monaca	PA	5649
Monessen	PA	7483
Monongahela	PA	4192
Monroe	PA	489
Monroeton	PA	565
Monroeville	PA	28176
Mont Alto	PA	1733
Mont Clare	PA	0
Montandon	PA	903
Montgomery	PA	1558
Montgomeryville	PA	12624
Montoursville	PA	4549
Montrose	PA	1583
Montrose Manor	PA	604
Monument	PA	150
Moores Mill	PA	0
Moose Run	PA	0
Moosic	PA	5751
Morea	PA	0
Morgan Hill	PA	0
Morgantown	PA	826
Morrell Park	PA	9577
Morris Run	PA	0
Morrisdale	PA	754
Morrisville	PA	8605
Morton	PA	6338
Moscow	PA	1960
Moshannon	PA	281
Mount Aetna	PA	354
Mount Bethel	PA	0
Mount Carbon	PA	89
Mount Carmel	PA	5728
Mount Cobb	PA	1799
Mount Eagle	PA	103
Mount Gretna	PA	197
Mount Gretna Heights	PA	323
Mount Holly Springs	PA	2037
Mount Jackson	PA	0
Mount Jewett	PA	899
Mount Joy	PA	8071
Mount Lebanon	PA	32730
Mount Morris	PA	737
Mount Oliver	PA	3354
Mount Penn	PA	3165
Mount Pleasant	PA	5163
Mount Pleasant Mill	PA	346
Mount Pleasant Mills	PA	464
Mount Pocono	PA	3065
Mount Royal	PA	0
Mount Union	PA	2396
Mount Wolf	PA	1382
Mountain Top	PA	10982
Mountainhome	PA	1182
Mountville	PA	2854
Muhlenberg Park	PA	1420
Muir	PA	451
Muncy	PA	2433
Mundys Corner	PA	1651
Munhall	PA	11247
Murrysville	PA	20134
Muse	PA	2504
Myerstown	PA	3140
Nanticoke	PA	10258
Nanty Glo	PA	2901
Nanty-Glo	PA	0
Naomi	PA	69
Narberth	PA	4309
Natrona	PA	0
Natrona Heights	PA	10927
Nazareth	PA	5681
Nealmont	PA	0
Needmore	PA	170
Nemacolin	PA	937
Nescopeck	PA	1552
Nesquehoning	PA	3251
New Albany	PA	349
New Alexandria	PA	560
New Baltimore	PA	175
New Beaver	PA	1450
New Bedford	PA	925
New Berlin	PA	867
New Berlinville	PA	1368
New Bethlehem	PA	941
New Bloomfield	PA	1080
New Boston	PA	0
New Brighton	PA	5891
New Britain	PA	3017
New Buffalo	PA	128
New Castle	PA	22375
New Castle Northwest	PA	1413
New Centerville	PA	131
New Columbia	PA	1013
New Columbus	PA	226
New Cumberland	PA	7295
New Eagle	PA	2126
New Florence	PA	666
New Freedom	PA	4585
New Freeport	PA	112
New Galilee	PA	364
New Holland	PA	5430
New Hope	PA	2510
New Jerusalem	PA	649
New Kensington	PA	12713
New Kingstown	PA	495
New Lebanon	PA	180
New Market	PA	705
New Milford	PA	866
New Morgan	PA	74
New Oxford	PA	1796
New Paris	PA	181
New Philadelphia	PA	1064
New Ringgold	PA	272
New Salem	PA	777
New Schaefferstown	PA	0
New Stanton	PA	2129
New Tripoli	PA	898
New Washington	PA	58
New Wilmington	PA	2233
Newburg	PA	340
Newell	PA	531
Newmanstown	PA	2478
Newport	PA	1566
Newry	PA	268
Newton Hamilton	PA	204
Newtown	PA	2222
Newtown Grant	PA	3620
Newville	PA	1331
Nicetown	PA	3690
Nicetown-Tioga	PA	17382
Nicholson	PA	739
Nicktown	PA	0
Nittany	PA	658
Nixon	PA	1373
Noblestown	PA	575
Normandy	PA	1258
Norristown	PA	34412
North Apollo	PA	1257
North Belle Vernon	PA	1905
North Bend	PA	0
North Braddock	PA	4787
North Catasauqua	PA	2828
North Charleroi	PA	1282
North East	PA	4172
North Irwin	PA	820
North Philipsburg	PA	660
North Towanda	PA	0
North Vandergrift	PA	447
North Versailles	PA	10571
North Wales	PA	3250
North Warren	PA	1934
North Washington	PA	0
North York	PA	2029
Northampton	PA	9860
Northern Cambria	PA	3658
Northern Liberties	PA	5966
Northumberland	PA	3728
Northwest Harborcreek	PA	8949
Northwood	PA	296
Norvelt	PA	948
Norwood	PA	5898
Nottingham	PA	0
Noxen	PA	633
Nuangola	PA	672
Numidia	PA	244
Nuremberg	PA	434
Oak Hills	PA	2333
Oak Lane	PA	0
Oakdale	PA	1470
Oakland	PA	1578
Oakmont	PA	6443
Oaks	PA	0
Oakwood	PA	2270
Oberlin	PA	588
Ogontz	PA	14740
Ohiopyle	PA	57
Ohioville	PA	3473
Oil	PA	0
Oil City	PA	10137
Oklahoma	PA	786
Old City	PA	6197
Old Forge	PA	8048
Old Orchard	PA	2434
Oley	PA	1282
Oliver	PA	2535
Olivia	PA	0
Olney	PA	39154
Olyphant	PA	5111
Oneida	PA	200
Orangeville	PA	504
Orbisonia	PA	415
Orchard Hills	PA	1952
Ore Hill	PA	0
Oreland	PA	5678
Oreminea	PA	0
Orrstown	PA	265
Orrtanna	PA	173
Orviston	PA	95
Orwigsburg	PA	3002
Orwin	PA	314
Osborne	PA	545
Osceola Mills	PA	1105
Oswayo	PA	137
Oval	PA	361
Overbrook	PA	32181
Oxford	PA	5385
Oxford Circle	PA	48856
Paint	PA	968
Palmdale	PA	1308
Palmer Heights	PA	3762
Palmerton	PA	5305
Palmyra	PA	7451
Palo Alto	PA	1009
Paoli	PA	5575
Paradise	PA	1129
Pardeesville	PA	572
Paris	PA	732
Park Crest	PA	542
Park Forest	PA	0
Park Forest Village	PA	9660
Park Place	PA	0
Parker	PA	822
Parkesburg	PA	3687
Parkhill	PA	0
Parkland	PA	0
Parkside	PA	2334
Parkville	PA	6706
Parkwood Manor	PA	16787
Parryville	PA	507
Paschall	PA	12450
Patterson Heights	PA	617
Patton	PA	1681
Paxtang	PA	1541
Paxtonia	PA	5412
Paxtonville	PA	265
Pen Argyl	PA	3541
Pen Mar	PA	929
Penbrook	PA	2974
Penfield	PA	0
Penn	PA	478
Penn Estates	PA	4493
Penn Farms	PA	0
Penn Hills	PA	44610
Penn Lake Park	PA	309
Penn State Berks	PA	0
Penn State Erie (Behrend)	PA	0
Penn Wynne	PA	5697
Penndel	PA	2221
Penns Creek	PA	715
Pennsburg	PA	3873
Pennsbury	PA	0
Pennsbury Village	PA	668
Pennside	PA	4215
Pennsport	PA	26000
Pennville	PA	1947
Pennwyn	PA	780
Pennypack	PA	9898
Pennypack Woods	PA	4328
Penryn	PA	1024
Perkasie	PA	8471
Perryopolis	PA	1728
Peru	PA	0
Petersburg	PA	470
Petrolia	PA	208
Philadelphia	PA	1573916
Philipsburg	PA	2715
Phoenixville	PA	16658
Picture Rocks	PA	663
Pikes Creek	PA	269
Pillow	PA	301
Pine Glen	PA	190
Pine Grove	PA	2142
Pine Grove Mills	PA	1502
Pine Ridge	PA	2707
Pine Run	PA	0
Pinecroft	PA	0
Pitcairn	PA	3246
Pittsburgh	PA	304391
Pittston	PA	7651
Pittville	PA	6218
Plainfield	PA	399
Plains	PA	4335
Platea	PA	411
Pleasant Gap	PA	2879
Pleasant Hill	PA	2643
Pleasant Hills	PA	8252
Pleasant View	PA	780
Pleasantville	PA	857
Pleasureville	PA	0
Plum	PA	27505
Plumsteadville	PA	2637
Plumville	PA	299
Plymouth	PA	5832
Plymouth Meeting	PA	6177
Plymptonville	PA	981
Pocono Mountain Lake Estates	PA	842
Pocono Pines	PA	1409
Pocono Ranch Lands	PA	1062
Pocono Springs	PA	926
Pocono Woodland Lakes	PA	0
Point Breeze	PA	16977
Point Marion	PA	1140
Point View	PA	0
Polk	PA	794
Pomeroy	PA	401
Poplar	PA	4450
Port Allegany	PA	2091
Port Carbon	PA	1817
Port Clinton	PA	320
Port Matilda	PA	598
Port Richmond	PA	27554
Port Royal	PA	922
Port Trevorton	PA	769
Port Vue	PA	3744
Portage	PA	2508
Portersville	PA	236
Portland	PA	510
Potlicker Flats	PA	0
Potters Mills	PA	0
Pottsgrove	PA	3469
Pottstown	PA	22664
Pottsville	PA	13802
Pringle	PA	969
Progress	PA	9765
Prompton	PA	240
Prospect	PA	1135
Prospect Park	PA	6481
Pughtown	PA	0
Pulaski	PA	0
Punxsutawney	PA	5861
Puzzletown	PA	0
Pymatuning Central	PA	2269
Pymatuning North	PA	311
Pymatuning South	PA	479
Quakertown	PA	8855
Quarryville	PA	2736
Queen Village	PA	6077
Queens Gate	PA	0
Quentin	PA	594
Radnor	PA	30878
Railroad	PA	279
Rainsburg	PA	133
Ramblewood	PA	849
Ramey	PA	444
Rankin	PA	2090
Ranshaw	PA	510
Raubsville	PA	1088
Rauchtown	PA	726
Ravine	PA	662
Reading	PA	87879
Reamstown	PA	3361
Rebersburg	PA	494
Red Hill	PA	2383
Red Lion	PA	6321
Reedsville	PA	641
Reese	PA	0
Refton	PA	298
Rehrersburg	PA	319
Reiffton	PA	4178
Reightown	PA	0
Reinerton	PA	424
Reinholds	PA	1803
Renfrew	PA	0
Rennerdale	PA	1150
Renningers	PA	574
Renovo	PA	1229
Republic	PA	1096
Reservoir	PA	0
Revloc	PA	570
Rew	PA	199
Reynolds Heights	PA	2061
Reynoldsville	PA	2710
Rhawnhurst	PA	25581
Rheems	PA	1598
Rices Landing	PA	443
Riceville	PA	68
Richboro	PA	6563
Richfield	PA	549
Richland	PA	1560
Richlandtown	PA	1312
Riddlesburg	PA	0
Ridgway	PA	3896
Ridley Park	PA	7035
Riegelsville	PA	858
Rimersburg	PA	911
Ringtown	PA	795
Rittenhouse	PA	21582
River View Park	PA	3380
Riverside	PA	1912
Riverview Park	PA	0
Roaring Spring	PA	2537
Robertsdale	PA	0
Robeson Extension	PA	0
Robesonia	PA	2064
Robinson	PA	614
Rochester	PA	3569
Rockdale Acres	PA	0
Rockhill	PA	361
Rockledge	PA	2541
Rockwood	PA	941
Rogersville	PA	249
Rohrerstown	PA	0
Rohrsburg	PA	145
Rome	PA	418
Ronco	PA	256
Ronks	PA	362
Roots	PA	0
Roscoe	PA	795
Rose Valley	PA	949
Rosebud	PA	0
Rosemont	PA	0
Roseto	PA	1549
Roseville	PA	188
Roslyn	PA	0
Rossiter	PA	646
Rosslyn Farms	PA	427
Rote	PA	507
Rothsville	PA	3044
Roulette	PA	779
Rouseville	PA	498
Rouzerville	PA	917
Rowes Run	PA	564
Roxborough	PA	14131
Royalton	PA	1023
Royer	PA	0
Royersford	PA	4771
Runville	PA	0
Rupert	PA	183
Rural Valley	PA	850
Russell	PA	1408
Russellton	PA	1440
Rutherford	PA	4303
Rutledge	PA	795
Ryers	PA	8015
S.N.P.J.	PA	0
Sabinsville	PA	0
Sadsburyville	PA	0
Saegertown	PA	973
Sagamore	PA	0
Saginaw	PA	0
Saint Clair	PA	3004
Saint Clairsville	PA	78
Saint Lawrence	PA	1809
Saint Marys	PA	13070
Saint Michael	PA	408
Saint Petersburg	PA	400
Salisbury	PA	697
Salix	PA	1149
Salladasburg	PA	239
Salona	PA	0
Saltillo	PA	345
Saltsburg	PA	837
Salunga	PA	2695
Sanatoga	PA	8378
Sand Hill	PA	2496
Sandy	PA	1429
Sandy Lake	PA	652
Sandy Ridge	PA	407
Sankertown	PA	650
Saw Creek	PA	4016
Saxonburg	PA	1491
Saxton	PA	706
Saylorsburg	PA	1126
Sayre	PA	5424
Scalp Level	PA	741
Schaefferstown	PA	941
Schellsburg	PA	333
Schenley	PA	0
Schlusser	PA	5265
Schnecksville	PA	2935
Schoeneck	PA	1056
Schubert	PA	249
Schuylkill	PA	1983
Schuylkill Haven	PA	5228
Schwenksville	PA	1398
Scotland	PA	1395
Scottdale	PA	4251
Scranton	PA	77118
Selinsgrove	PA	5792
Sellersville	PA	4212
Seltzer	PA	350
Seneca	PA	1065
Seven Fields	PA	2846
Seven Springs	PA	26
Seven Valleys	PA	506
Seward	PA	477
Sewickley	PA	3829
Sewickley Heights	PA	820
Sewickley Hills	PA	736
Shade Gap	PA	104
Shamokin	PA	7162
Shamokin Dam	PA	1706
Shanksville	PA	230
Shanor-Northvue	PA	5051
Sharon	PA	13562
Sharon Hill	PA	5702
Sharpsburg	PA	3398
Sharpsville	PA	4271
Shartlesville	PA	455
Shavertown	PA	2019
Shawmont	PA	5850
Sheakleyville	PA	139
Sheatown	PA	671
Sheffield	PA	1132
Shelltown	PA	0
Shellytown	PA	0
Shelocta	PA	126
Shenandoah	PA	4873
Shenandoah Heights	PA	1233
Sheppton	PA	239
Shickshinny	PA	827
Shillington	PA	5265
Shiloh	PA	11218
Shinglehouse	PA	1093
Shippensburg	PA	5559
Shippensburg University	PA	0
Shippenville	PA	454
Shippingport	PA	211
Shiremanstown	PA	1580
Shirleysburg	PA	148
Shoemakersville	PA	1369
Shrewsbury	PA	3863
Sickles Corner	PA	0
Sidman	PA	431
Sierra View	PA	4813
Siglerville	PA	106
Silkworth	PA	820
Silverdale	PA	856
Simpson	PA	1275
Sinking Spring	PA	4101
Sinnamahoning	PA	0
Skelp	PA	0
Ski Gap	PA	0
Skippack	PA	3758
Skyline View	PA	4003
Slabtown	PA	156
Slatedale	PA	455
Slatington	PA	4276
Slickville	PA	388
Sligo	PA	692
Slippery Rock	PA	3613
Slippery Rock University	PA	0
Slovan	PA	555
Smethport	PA	1595
Smicksburg	PA	44
Smith Corner	PA	0
Smithfield	PA	859
Smithton	PA	381
Smock	PA	583
Smoketown	PA	357
Snow Shoe	PA	776
Snydertown	PA	483
Somerset	PA	6032
Somerton	PA	33247
Soudersburg	PA	540
Souderton	PA	6747
South Bethlehem	PA	462
South Coatesville	PA	1435
South Connellsville	PA	1935
South Fork	PA	876
South Greensburg	PA	2054
South Heights	PA	460
South Montrose	PA	0
South New Castle	PA	679
South Park Township	PA	13416
South Philipsburg	PA	410
South Pottstown	PA	2081
South Renovo	PA	435
South Temple	PA	1424
South Uniontown	PA	1360
South Waverly	PA	1025
South Williamsport	PA	6281
Southmont	PA	2175
Southpointe	PA	0
Southview	PA	276
Southwest Center City Philadelphia	PA	11228
Southwest Greensburg	PA	2086
Southwest Schuylkill	PA	8666
Spangler	PA	1942
Spartansburg	PA	299
Speers	PA	1132
Spinnerstown	PA	1826
Spring	PA	0
Spring Church	PA	0
Spring City	PA	3322
Spring Drive Mobile Home Park	PA	0
Spring Grove	PA	2168
Spring Hill	PA	839
Spring House	PA	3804
Spring Mills	PA	268
Spring Mount	PA	2259
Spring Ridge	PA	1003
Springboro	PA	456
Springdale	PA	3375
Springfield	PA	23363
Springmont	PA	724
Springville	PA	0
Sproul	PA	0
Spruce Hill	PA	9935
Spry	PA	4891
St. Benedict	PA	0
St. Clair	PA	0
St. Clairsville	PA	0
St. Davids	PA	0
St. Lawrence	PA	0
St. Marys	PA	0
St. Michael	PA	0
St. Petersburg	PA	0
St. Vincent College	PA	0
Star Junction	PA	616
Starbrick	PA	522
Starrucca	PA	167
State College	PA	42161
State Line	PA	2709
Steelton	PA	5932
Stevens	PA	612
Stewartstown	PA	2305
Stiles	PA	1113
Stillwater	PA	210
Stockdale	PA	505
Stockertown	PA	916
Stoneboro	PA	1015
Stonerstown	PA	376
Stony Creek Mills	PA	1045
Stonybrook	PA	2384
Stormstown	PA	2366
Stouchsburg	PA	600
Stowe	PA	3695
Stoystown	PA	355
Strabane	PA	0
Strasburg	PA	2906
Strattanville	PA	525
Strausstown	PA	345
Strawberry Mansion	PA	15778
Strodes Mills	PA	757
Strong	PA	147
Stroudsburg	PA	5444
Sturgeon	PA	1710
Sugar Grove	PA	604
Sugar Notch	PA	973
Sugarcreek	PA	5120
Summerhill	PA	465
Summerville	PA	519
Summit Hill	PA	2952
Summit Station	PA	174
Sun Valley	PA	2399
Sunbrook	PA	0
Sunbury	PA	9652
Sunrise Lake	PA	1387
Susquehanna	PA	1809
Susquehanna Depot	PA	0
Susquehanna Trails	PA	2264
Sutersville	PA	583
Swarthmore	PA	6211
Swartzville	PA	2283
Swedeland	PA	0
Sweden Valley	PA	223
Swedesburg	PA	0
Swissvale	PA	8855
Swoyersville	PA	4984
Sykesville	PA	1135
Sylvan Hills	PA	0
Sylvania	PA	216
Table Rock	PA	62
Tacony	PA	17846
Tamaqua	PA	6829
Tannersville	PA	2784
Tarentum	PA	4462
Tatamy	PA	1131
Taylor	PA	6025
Taylorstown	PA	217
Taylorstown Station	PA	217
Telford	PA	4861
Temple	PA	1877
Templeton	PA	325
Terre Hill	PA	1382
Tharptown (Uniontown)	PA	0
The Escape	PA	0
The Hideout	PA	3013
Thompson	PA	280
Thompsontown	PA	680
Thompsonville	PA	3520
Thornburg	PA	455
Thorndale	PA	3407
Three Springs	PA	434
Throop	PA	3960
Tidioute	PA	673
Timber Hills	PA	360
Timblin	PA	154
Tinicum	PA	4350
Tioga	PA	662
Tionesta	PA	451
Tipton	PA	1083
Titusville	PA	5389
Toftrees	PA	2053
Topton	PA	2062
Torresdale	PA	10836
Toughkenamon	PA	1492
Towamensing Trails	PA	2292
Towanda	PA	2812
Tower	PA	0
Tower City	PA	1316
Townville	PA	318
Trafford	PA	3144
Trainer	PA	1844
Trappe	PA	3553
Treasure Lake	PA	3861
Tremont	PA	1716
Tresckow	PA	880
Trevorton	PA	1834
Trevose	PA	3550
Trexlertown	PA	1988
Trooper	PA	5744
Troutville	PA	236
Troxelville	PA	221
Troy	PA	1454
Trucksville	PA	2152
Trumbauersville	PA	959
Tullytown	PA	1859
Tulpehocken	PA	7382
Tunkhannock	PA	1780
Tunnelhill	PA	354
Turbotville	PA	687
Turtle Creek	PA	5272
Tuscarora	PA	980
Twilight	PA	231
Twin Rocks	PA	0
Tyler Run	PA	0
Tylersburg	PA	196
Tylersville	PA	0
Tyrone	PA	5353
Tyrone Forge	PA	0
Ulster	PA	0
Ulysses	PA	603
Union	PA	0
Union City	PA	3217
Union Dale	PA	245
Union Deposit	PA	407
Uniontown	PA	9990
Unionville	PA	962
University City	PA	17578
University of Pittsburgh Bradford	PA	0
University of Pittsburgh Johnstown	PA	0
Upland	PA	3251
Upper Exeter	PA	707
Upper Roxborough	PA	10735
Upper Saint Clair	PA	19229
Ursina	PA	209
Utica	PA	184
Vail	PA	0
Valencia	PA	579
Valley Green	PA	3429
Valley View	PA	2817
Valley-Hi	PA	15
Van Voorhis	PA	166
Vanderbilt	PA	468
Vandergrift	PA	5032
Vandling	PA	722
Venango	PA	241
Verona	PA	2442
Versailles	PA	1496
Vicksburg	PA	261
Village Green-Green Ridge	PA	7822
Village Shires	PA	3949
Villanova	PA	0
Vinco	PA	1305
Vintondale	PA	391
Virginville	PA	309
Volant	PA	164
Vowinckel	PA	139
Wagner	PA	128
Wakefield	PA	609
Wall	PA	571
Wallaceton	PA	313
Wallenpaupack Lake Estates	PA	1279
Waller	PA	48
Walnutport	PA	2061
Walnuttown	PA	484
Wampum	PA	688
Wanamie	PA	612
Warfordsburg	PA	0
Warminster Heights	PA	4124
Warren	PA	9334
Warrior Run	PA	588
Warriors Mark	PA	0
Washington	PA	13497
Washington Boro	PA	729
Washington Square	PA	13438
Washingtonville	PA	278
Waterford	PA	1538
Watsontown	PA	2320
Wattsburg	PA	385
Waverly	PA	604
Waymart	PA	1279
Wayne	PA	30892
Wayne Heights	PA	2545
Waynesboro	PA	10848
Waynesburg	PA	4045
Weatherly	PA	2462
Webster	PA	255
Weedville	PA	542
Weigelstown	PA	12875
Weissport	PA	412
Weissport East	PA	1624
Wellersburg	PA	175
Wells Tannery	PA	0
Wellsboro	PA	3290
Wellsville	PA	258
Wernersville	PA	2540
Wescosville	PA	5872
Wesleyville	PA	3226
West Alexander	PA	604
West Brownsville	PA	974
West Chester	PA	19842
West Conshohocken	PA	1381
West Decatur	PA	533
West Easton	PA	1251
West Elizabeth	PA	508
West Fairview	PA	1282
West Falls	PA	382
West Grove	PA	2859
West Hamburg	PA	1979
West Hazleton	PA	4503
West Hills	PA	1263
West Homestead	PA	1919
West Kensington	PA	11532
West Kittanning	PA	1134
West Lawn	PA	1715
West Leechburg	PA	1294
West Liberty	PA	340
West Mayfield	PA	1213
West Middlesex	PA	841
West Middletown	PA	138
West Mifflin	PA	20075
West Milton	PA	900
West Mount Airy	PA	12635
West Myerstown	PA	0
West Nanticoke	PA	749
West Newton	PA	2544
West Norriton	PA	14702
West Oak Lane	PA	38699
West Pittsburg	PA	808
West Pittston	PA	4772
West Reading	PA	4191
West Sunbury	PA	188
West View	PA	6685
West Waynesburg	PA	446
West Wilmerding	PA	0
West Wyoming	PA	2703
West Wyomissing	PA	3407
West York	PA	4569
Westfield	PA	1052
Westland	PA	167
Westmont	PA	4938
Weston	PA	321
Westover	PA	382
Westwood	PA	950
Wharton	PA	49732
Wheatland	PA	723
Whitaker	PA	1254
White Haven	PA	1097
White Mills	PA	659
White Oak	PA	7775
Whitehall	PA	13834
Whitehall Township	PA	24896
Whitfield	PA	4733
Whitman	PA	49732
Wickerham Manor-Fisher	PA	1728
Wiconisco	PA	921
Wiconsico	PA	0
Wilburton Number One	PA	196
Wilburton Number Two	PA	96
Wilcox	PA	383
Wilkes-Barre	PA	40780
Wilkinsburg	PA	15731
Williamsburg	PA	1222
Williamsport	PA	29201
Williamstown	PA	1375
Willow Grove	PA	15726
Willow Street	PA	7578
Wilmerding	PA	2156
Wilmore	PA	220
Wilson	PA	7781
Winburne	PA	0
Winchester Park	PA	1884
Wind Gap	PA	2701
Wind Ridge	PA	215
Windber	PA	3974
Windsor	PA	1480
Winfield	PA	900
Winterstown	PA	625
Wissinoming	PA	21445
Wister	PA	4318
Witmer	PA	492
Wolfdale	PA	2888
Womelsdorf	PA	2859
Wood	PA	0
Woodbourne	PA	3851
Woodbury	PA	276
Woodcock	PA	157
Woodland	PA	0
Woodland Heights	PA	1261
Woodlyn	PA	9485
Woodside	PA	2425
Woodward	PA	110
Woolrich	PA	0
Wopsononock	PA	0
Wormleysburg	PA	3079
Worthington	PA	614
Worthville	PA	66
Woxall	PA	1318
Wrightsville	PA	2290
Wurtemburg	PA	0
Wyalusing	PA	572
Wyano	PA	484
Wylandville	PA	391
Wyncote	PA	3044
Wyndmoor	PA	5498
Wynnefield Heights	PA	7595
Wynnewood	PA	0
Wyoming	PA	3044
Wyomissing	PA	10469
Wyomissing Hills	PA	2606
Yardley	PA	2441
Yarnell	PA	0
Yatesboro	PA	0
Yatesville	PA	617
Yeadon	PA	11523
Yeagertown	PA	1050
Yellow Springs	PA	0
Yoe	PA	1011
York	PA	43992
York Haven	PA	700
York Springs	PA	838
Yorkana	PA	230
Yorklyn	PA	1912
Yorktown	PA	5909
Youngstown	PA	316
Youngsville	PA	1732
Youngwood	PA	2956
Yukon	PA	677
Zelienople	PA	3709
Zion	PA	2030
Ashaway	RI	1485
Barrington	RI	16669
Bradford	RI	1406
Bristol	RI	22795
Carolina	RI	970
Central Falls	RI	19303
Charlestown	RI	8421
Chepachet	RI	1675
Clayville	RI	300
Coventry	RI	35525
Cranston	RI	81073
Cumberland	RI	34843
Cumberland Hill	RI	7934
East Greenwich	RI	13682
East Providence	RI	47408
Exeter	RI	6426
Foster	RI	4598
Foster Center	RI	355
Greene	RI	888
Greenville	RI	8658
Harmony	RI	985
Harrisville	RI	1605
Hope Valley	RI	1612
Hopkinton	RI	8261
Jamestown	RI	5755
Johnston	RI	29247
Kingston	RI	6974
Lincoln	RI	21670
Melville	RI	1320
Middletown	RI	17303
Misquamicut	RI	390
Narragansett	RI	15868
Narragansett Pier	RI	3409
New Shoreham	RI	1047
Newport	RI	24232
Newport East	RI	11769
North Kingstown	RI	28042
North Providence	RI	33835
North Scituate	RI	11171
North Smithfield	RI	11212
Pascoag	RI	4577
Pawtucket	RI	71591
Portsmouth	RI	17756
Providence	RI	190934
Quonochontaug	RI	333
Smithfield	RI	21872
South Kingstown	RI	30826
Tiverton	RI	7557
Valley Falls	RI	11547
Wakefield-Peace Dale	RI	0
Wakefield-Peacedale	RI	8487
Warren	RI	11280
Warwick	RI	81699
Watch Hill	RI	154
Weekapaug	RI	425
West Greenwich	RI	6135
West Warwick	RI	30146
Westerly	RI	17936
Woonsocket	RI	41475
Wyoming	RI	270
Abbeville	SC	5191
Abney Crossroads	SC	0
Adams Run	SC	0
Aiken	SC	30604
Alcolu	SC	429
Allendale	SC	3126
Anderson	SC	27335
Andrews	SC	2888
Antreville	SC	140
Arcadia	SC	2634
Arcadia Lakes	SC	869
Arial	SC	2543
Arkwright	SC	0
Arthurtown	SC	0
Ashwood	SC	0
Atlantic Beach	SC	384
Awendaw	SC	1371
Aynor	SC	667
Bamberg	SC	3383
Barnwell	SC	4592
Batesburg	SC	4380
Batesburg-Leesville	SC	5441
Baxter	SC	0
Beaufort	SC	13306
Beech Island	SC	0
Belton	SC	4336
Belvedere	SC	5792
Ben Avon	SC	0
Bennettsville	SC	8605
Berea	SC	14295
Bethune	SC	345
Bishopville	SC	3274
Blacksburg	SC	1883
Blackville	SC	2295
Blenheim	SC	148
Bluffton	SC	16728
Blythewood	SC	2782
Boiling Springs	SC	8219
Bonneau	SC	505
Bonneau Beach	SC	1929
Bowman	SC	934
Boykin	SC	100
Bradley	SC	170
Branchville	SC	989
Briarcliffe Acres	SC	529
Brookdale	SC	4873
Browntown	SC	0
Brunson	SC	523
Bucksport	SC	876
Buffalo	SC	1266
Buford	SC	0
Burnettown	SC	2673
Burton	SC	6976
Caesars Head	SC	0
Calhoun Falls	SC	1964
Camden	SC	7085
Cameron	SC	415
Camp Croft	SC	0
Campobello	SC	526
Cane Savannah	SC	1117
Capitol View	SC	0
Carlisle	SC	413
Carolina Forest	SC	0
Cash	SC	0
Catawba	SC	1343
Cateechee	SC	0
Cayce	SC	13619
Centenary	SC	0
Centerville	SC	6586
Central	SC	5167
Central Pacolet	SC	216
Chapin	SC	1554
Chappells	SC	49
Charleston	SC	132609
Cheraw	SC	5778
Cherokee Falls	SC	0
Cherryvale	SC	2496
Chesnee	SC	899
Chester	SC	5486
Chesterfield	SC	1452
Chickasaw Point	SC	0
City View	SC	1345
Clarks Hill	SC	381
Clearwater	SC	4370
Clemson	SC	15446
Clemson University	SC	0
Clifton	SC	541
Clinton	SC	8637
Clio	SC	689
Clover	SC	5744
Cokesbury	SC	215
Columbia	SC	142416
Conestee	SC	0
Converse	SC	608
Conway	SC	21053
Coosawhatchie	SC	0
Cope	SC	75
Cordova	SC	165
Coronaca	SC	191
Cottageville	SC	738
Coward	SC	750
Cowpens	SC	2267
Creekside Apartments	SC	480
Cross Anchor	SC	126
Cross Hill	SC	497
Dacusville	SC	0
Dale	SC	0
Dalzell	SC	3059
Danwood	SC	0
Darlington	SC	6155
Daufuskie Island	SC	0
Daviston	SC	0
DeBordieu Colony	SC	0
Denmark	SC	3315
Dentsville	SC	14062
Dillon	SC	6677
Donalds	SC	343
Dovesville	SC	0
Drayton	SC	0
Due West	SC	1239
Dunbar	SC	0
Duncan	SC	3317
Dunean	SC	3671
Easley	SC	20765
East Camden	SC	0
East Gaffney	SC	3085
East Sumter	SC	1343
Eastover	SC	817
Edgefield	SC	4760
Edisto	SC	2559
Edisto Beach	SC	415
Edmund	SC	0
Ehrhardt	SC	507
Elgin	SC	2607
Elko	SC	187
Elliott	SC	0
Elloree	SC	681
Enoree	SC	665
Estill	SC	1950
Eureka Mill	SC	1476
Eutawville	SC	306
Fair Play	SC	687
Fairfax	SC	1822
Fairforest	SC	1693
Fairview Crossroads	SC	0
Fingerville	SC	134
Finklea	SC	0
Five Forks	SC	14140
Florence	SC	38228
Floydale	SC	0
Folly Beach	SC	2774
Forest Acres	SC	10615
Forestbrook	SC	4612
Foreston	SC	0
Fort Lawn	SC	867
Fort Mill	SC	13662
Fountain Inn	SC	8317
Fripp Island	SC	0
Furman	SC	228
Gadsden	SC	1632
Gaffney	SC	12566
Gantt	SC	14229
Garden	SC	0
Garden City	SC	9209
Gaston	SC	1658
Gayle Mill	SC	913
Georgetown	SC	9062
Gifford	SC	273
Gilbert	SC	604
Gillisonville	SC	0
Glendale	SC	307
Glenn Springs	SC	0
Gloverville	SC	2831
Golden Grove	SC	2467
Goose Creek	SC	40633
Govan	SC	61
Gramling	SC	86
Graniteville	SC	2614
Gray Court	SC	791
Great Falls	SC	1932
Greeleyville	SC	409
Green Sea	SC	0
Greenville	SC	64579
Greenwood	SC	23260
Greer	SC	28365
Grover	SC	0
Hamer	SC	0
Hampton	SC	2664
Hanahan	SC	17997
Harbor Island	SC	0
Hardeeville	SC	5301
Harleyville	SC	694
Hartsville	SC	7826
Heath Springs	SC	900
Helena	SC	0
Hemingway	SC	432
Hickory Grove	SC	490
Hilda	SC	426
Hilltop	SC	0
Hilton Head	SC	37099
Hilton Head Island	SC	40512
Hodges	SC	154
Holly Hill	SC	1237
Hollywood	SC	4962
Homeland Park	SC	6296
Homewood	SC	0
Honea Path	SC	3707
Hopkins	SC	2882
India Hook	SC	3328
Inman	SC	2273
Inman Mills	SC	1050
Irmo	SC	12056
Irwin	SC	1405
Islandton	SC	70
Isle of Palms	SC	4133
Iva	SC	1278
Jackson	SC	1762
Jacksonboro	SC	478
James Island	SC	6000
Jamestown	SC	80
Jefferson	SC	745
Jenkinsville	SC	46
Joanna	SC	1539
Johnsonville	SC	1504
Johnston	SC	2348
Jonesville	SC	864
Judson	SC	2050
Keowee Key	SC	0
Kershaw	SC	2052
Ketchuptown	SC	0
Kiawah Island	SC	1749
Kingstree	SC	3183
Kline	SC	191
La France	SC	0
Ladson	SC	13790
Lake	SC	0
Lake City	SC	6788
Lake Murray of Richland	SC	5484
Lake Secession	SC	1083
Lake View	SC	790
Lake Wylie	SC	8841
Lakewood	SC	3032
Lamar	SC	971
Lancaster	SC	8956
Lancaster Mill	SC	1978
Landrum	SC	2493
Lane	SC	477
Langley	SC	1447
Latta	SC	1351
Laurel Bay	SC	5891
Laurens	SC	9166
Leesville	SC	2235
Lesslie	SC	3112
Lexington	SC	20138
Liberty	SC	3246
Lincolnville	SC	1211
Litchfield Beach	SC	0
Little Mountain	SC	296
Little River	SC	8960
Little Rock	SC	0
Live Oak	SC	0
Livingston	SC	133
Lobeco	SC	0
Lockhart	SC	473
Lodge	SC	118
Longcreek	SC	0
Loris	SC	2591
Lowndesville	SC	123
Lowrys	SC	196
Lugoff	SC	7434
Luray	SC	122
Lydia	SC	642
Lyman	SC	3423
Lynchburg	SC	354
Manning	SC	4037
Manville	SC	0
Marion	SC	6714
Mauldin	SC	25135
Mayesville	SC	728
Mayo	SC	1592
McBee	SC	855
McClellanville	SC	530
McColl	SC	2068
McConnells	SC	270
McCormick	SC	2578
Meggett	SC	1315
Millwood	SC	885
Modoc	SC	218
Monarch Mill	SC	1811
Moncks Corner	SC	9873
Monetta	SC	233
Mount Carmel	SC	216
Mount Croghan	SC	194
Mount Pleasant	SC	81317
Mountville	SC	108
Mulberry	SC	529
Mullins	SC	4519
Murphys Estates	SC	1441
Murrells Inlet	SC	7547
Myrtle Beach	SC	31035
Neeses	SC	358
New Ellenton	SC	2121
Newberry	SC	10331
Newport	SC	4136
Newry	SC	172
Newtown	SC	0
Nichols	SC	358
Ninety Six	SC	2048
Norris	SC	819
North	SC	742
North Augusta	SC	22522
North Charleston	SC	108304
North Hartsville	SC	3251
North Myrtle Beach	SC	15579
North Santee	SC	0
Northlake	SC	3745
Norway	SC	328
Oak Grove	SC	10291
Oakland	SC	1232
Olanta	SC	570
Olar	SC	239
Olympia	SC	0
Orangeburg	SC	13460
Oswego	SC	84
Pacolet	SC	2352
Pacolet Mills	SC	956
Pageland	SC	2746
Pamplico	SC	1245
Parker	SC	11431
Parksville	SC	112
Patrick	SC	347
Pauline	SC	0
Pawleys Island	SC	107
Paxville	SC	185
Peak	SC	65
Pelion	SC	704
Pelzer	SC	91
Pendleton	SC	3152
Perry	SC	236
Pickens	SC	3173
Piedmont	SC	5103
Pimlico	SC	0
Pine Ridge	SC	0
Pineridge	SC	2064
Pinewood	SC	537
Pinopolis	SC	948
Plum Branch	SC	78
Pomaria	SC	181
Port Royal	SC	12122
Powdersville	SC	7618
Princeton	SC	62
Privateer	SC	2349
Promised Land	SC	511
Prosperity	SC	1200
Quinby	SC	943
Rains	SC	0
Ravenel	SC	2600
Red Bank	SC	9617
Red Hill	SC	13223
Reevesville	SC	206
Reidville	SC	619
Rembert	SC	306
Richburg	SC	264
Ridge Spring	SC	746
Ridgeland	SC	3999
Ridgeville	SC	1836
Ridgeway	SC	306
Riverview	SC	681
Rock Hill	SC	71548
Rockville	SC	140
Roebuck	SC	2200
Rowesville	SC	296
Ruby	SC	351
Russellville	SC	488
Saint Andrews	SC	21151
Saint George	SC	2084
Saint Matthews	SC	2021
Saint Stephen	SC	1697
Salem	SC	148
Salley	SC	417
Saluda	SC	3596
Sandy Springs	SC	0
Sangaree	SC	8220
Sans Souci	SC	7869
Santee	SC	935
Saxon	SC	3424
Scotia	SC	207
Scranton	SC	863
Seabrook	SC	0
Seabrook Island	SC	1844
Sellers	SC	213
Seneca	SC	8279
Seven Oaks	SC	15144
Sharon	SC	554
Sheldon	SC	0
Shell Point	SC	2817
Shiloh	SC	214
Silverstreet	SC	163
Simpsonville	SC	20736
Six Mile	SC	683
Slater-Marietta	SC	2176
Smoaks	SC	124
Smyrna	SC	59
Snelling	SC	259
Socastee	SC	19952
Society Hill	SC	548
South Congaree	SC	2388
South Sumter	SC	2411
South Union	SC	0
Southern Shops	SC	3767
Spartanburg	SC	37867
Springdale	SC	2783
Springfield	SC	503
St. Andrews	SC	0
St. Charles	SC	0
St. George	SC	0
St. Matthews	SC	0
St. Stephen	SC	0
Starr	SC	191
Startex	SC	859
Stateburg	SC	1380
Stuckey	SC	235
Sullivan's Island	SC	0
Sullivans Island	SC	1791
Summerton	SC	965
Summerville	SC	48848
Summit	SC	432
Sumter	SC	40816
Surfside Beach	SC	4280
Swansea	SC	891
Sycamore	SC	161
Tamassee	SC	0
Tatum	SC	72
Taylors	SC	21617
Tega Cay	SC	9608
The Cliffs Valley	SC	0
Tigerville	SC	1312
Timmonsville	SC	2378
Tradesville	SC	0
Travelers Rest	SC	4994
Trenton	SC	191
Troy	SC	93
Turbeville	SC	804
Ulmer	SC	78
Union	SC	8045
Unity	SC	0
Utica	SC	1489
Valley Falls	SC	6299
Van Wyck	SC	0
Vance	SC	166
Varnville	SC	2067
Wade Hampton	SC	20622
Wagener	SC	822
Walhalla	SC	4251
Wallace	SC	892
Walterboro	SC	5278
Ward	SC	92
Ware Place	SC	228
Ware Shoals	SC	2175
Warrenville	SC	1233
Waterloo	SC	160
Watts Mills	SC	1635
Wedgefield	SC	1615
Wedgewood	SC	1628
Welcome	SC	6668
Wellford	SC	2526
West Columbia	SC	16060
West Pelzer	SC	906
West Union	SC	312
Westminster	SC	2484
White Knoll	SC	0
Whitmire	SC	1462
Whitney	SC	0
Wilkinson Heights	SC	2493
Williams	SC	115
Williamston	SC	4124
Willington	SC	142
Williston	SC	3028
Windsor	SC	122
Winnsboro	SC	3351
Winnsboro Mills	SC	1898
Wisacky	SC	0
Woodfield	SC	9303
Woodford	SC	180
Woodruff	SC	4129
Wyboo	SC	0
Yemassee	SC	981
York	SC	8009
Zion	SC	0
Aberdeen	SD	28102
Agar	SD	77
Agency	SD	0
Agency Village	SD	181
Akaska	SD	43
Albee	SD	15
Alcester	SD	761
Alexandria	SD	623
Allen	SD	420
Alpena	SD	275
Altamont	SD	34
Anderson	SD	0
Andover	SD	87
Angostura	SD	0
Antelope	SD	826
Ardmore	SD	0
Arlington	SD	883
Armour	SD	686
Artas	SD	9
Artesian	SD	138
Ashland Heights	SD	754
Ashton	SD	125
Astoria	SD	138
Aurora	SD	650
Aurora Center	SD	12
Avon	SD	571
Badger	SD	103
Baltic	SD	1132
Bancroft	SD	18
Batesland	SD	108
Bath	SD	172
Bath Corner	SD	49
Belle Fourche	SD	5696
Belvidere	SD	54
Beresford	SD	1976
Big Stone	SD	0
Big Stone City	SD	455
Bijou Hills	SD	6
Bison	SD	339
Blackhawk	SD	2892
Blucksberg Mountain	SD	462
Blumengard Colony	SD	0
Blunt	SD	359
Bon Homme Colony	SD	0
Bonesteel	SD	270
Boulder Canyon	SD	0
Bowdle	SD	502
Box Elder	SD	9289
Bradley	SD	71
Brandon	SD	9856
Brandt	SD	106
Brant Lake	SD	159
Brant Lake South	SD	0
Brentford	SD	78
Brentwood Colony	SD	0
Bridger	SD	0
Bridgewater	SD	476
Bristol	SD	327
Britton	SD	1242
Broadland	SD	32
Brookings	SD	23657
Bruce	SD	208
Bryant	SD	453
Buffalo	SD	345
Buffalo Gap	SD	121
Bullhead	SD	348
Burbank	SD	0
Burke	SD	589
Bushnell	SD	65
Butler	SD	16
Cameron Colony	SD	0
Camp Crook	SD	66
Camrose Colony	SD	0
Canistota	SD	638
Canova	SD	96
Canton	SD	3331
Caputa	SD	0
Carthage	SD	135
Castlewood	SD	636
Cavour	SD	119
Cedar Grove Colony	SD	0
Centerville	SD	868
Central	SD	0
Central City	SD	130
Chamberlain	SD	2386
Chancellor	SD	258
Chelsea	SD	26
Cherry Creek	SD	0
Chester	SD	261
Claire	SD	0
Claire City	SD	79
Claremont	SD	128
Claremont Colony	SD	0
Clark	SD	1050
Clark Colony	SD	0
Clear Lake	SD	1273
Clearfield Colony	SD	0
Cloverleaf Colony	SD	0
Collins Colony	SD	0
Colman	SD	576
Colome	SD	283
Colonial Pine Hills	SD	2493
Colton	SD	690
Columbia	SD	137
Conde	SD	145
Corn Creek	SD	105
Corona	SD	110
Corsica	SD	595
Cottonwood	SD	10
Cow Creek	SD	0
Cresbard	SD	101
Crocker	SD	19
Crook	SD	0
Crooks	SD	1329
Custer	SD	1952
Dakota Dunes	SD	2540
Dallas	SD	122
Dante	SD	86
Davis	SD	82
De Smet	SD	1072
Deadwood	SD	1258
Deerfield Colony	SD	0
Dell Rapids	SD	3706
Delmont	SD	232
Dimock	SD	123
Doland	SD	185
Dolton	SD	36
Draper	SD	73
Dudley	SD	0
Dupree	SD	527
Eagle Butte	SD	1318
Eden	SD	91
Edgemont	SD	739
Egan	SD	274
Elk Point	SD	2075
Elkton	SD	731
Ellsworth Air Force Base	SD	8000
Emery	SD	454
Enemy Swim	SD	0
Erwin	SD	43
Estelline	SD	756
Ethan	SD	331
Eureka	SD	844
Evergreen Colony	SD	0
Fairburn	SD	82
Fairfax	SD	113
Fairview	SD	65
Faith	SD	414
Farmer	SD	10
Faulkton	SD	740
Fedora	SD	37
Ferney	SD	43
Flandreau	SD	2303
Florence	SD	370
Fordham Colony	SD	0
Forestburg	SD	73
Fort Pierre	SD	2117
Fort Thompson	SD	1282
Frankfort	SD	154
Frederick	SD	204
Freeman	SD	1287
Fruitdale	SD	64
Fulton	SD	92
Gann Valley	SD	0
Gannvalley	SD	14
Garden	SD	0
Garden City	SD	53
Garretson	SD	1201
Gary	SD	230
Gayville	SD	415
Geddes	SD	214
Gettysburg	SD	1164
Glendale Colony	SD	0
Glenham	SD	105
Golden View Colony	SD	0
Goodwill	SD	513
Goodwin	SD	144
Graceville Colony	SD	0
Grass Ranch Colony	SD	0
Grassland Colony	SD	0
Green Grass	SD	35
Green Valley	SD	928
Greenwood Colony	SD	0
Gregory	SD	1254
Grenville	SD	51
Groton	SD	1508
Hamill	SD	11
Harrisburg	SD	5498
Harrison	SD	52
Harrold	SD	124
Hartford	SD	3025
Hayti	SD	381
Hazel	SD	90
Hecla	SD	229
Henry	SD	264
Hermosa	SD	392
Herreid	SD	421
Herrick	SD	103
Hetland	SD	44
Highmore	SD	779
Hill	SD	0
Hill City	SD	995
Hillcrest Colony	SD	0
Hillside Colony	SD	0
Hillsview	SD	3
Hitchcock	SD	95
Horse Creek	SD	0
Hosmer	SD	203
Hot Springs	SD	3532
Hoven	SD	403
Howard	SD	790
Hudson	SD	316
Humboldt	SD	583
Hurley	SD	400
Huron	SD	13313
Huron Colony	SD	0
Hutterville Colony	SD	0
Ideal	SD	0
Interior	SD	103
Ipswich	SD	959
Irene	SD	409
Iroquois	SD	263
Isabel	SD	145
Jamesville Colony	SD	0
Java	SD	129
Jefferson	SD	517
Johnson Siding	SD	659
Kadoka	SD	707
Kaylor	SD	47
Kenel	SD	0
Kennebec	SD	260
Keystone	SD	343
Kidder	SD	57
Kimball	SD	686
Kranzburg	SD	178
Kyle	SD	846
La Bolt	SD	0
La Plant	SD	171
LaBolt	SD	95
Lake	SD	0
Lake Andes	SD	840
Lake City	SD	52
Lake Madison	SD	0
Lake Norden	SD	480
Lake Poinsett	SD	0
Lake Preston	SD	568
Lakeview Colony	SD	0
Lane	SD	57
Langford	SD	324
Lantry	SD	0
Lead	SD	2999
Lebanon	SD	47
Lemmon	SD	1232
Lennox	SD	2272
Leola	SD	440
Lesterville	SD	126
Letcher	SD	173
Lily	SD	4
Little Eagle	SD	319
Long Hollow	SD	0
Long Lake	SD	31
Long Lake Colony	SD	0
Loomis	SD	34
Lower Brule	SD	613
Lowry	SD	6
Lyons	SD	0
Madison	SD	7258
Manderson-White Horse Creek	SD	626
Mansfield	SD	93
Marion	SD	767
Martin	SD	1061
Marty	SD	402
Marvin	SD	33
Maverick Junction	SD	0
Maxwell Colony	SD	0
Mayfield Colony	SD	0
McIntosh	SD	175
McLaughlin	SD	679
Meadow View Addition	SD	538
Meckling	SD	0
Mellette	SD	218
Menno	SD	595
Midland	SD	124
Milbank	SD	3192
Millbrook Colony	SD	0
Miller	SD	1437
Millerdale Colony	SD	0
Milltown	SD	10
Mina	SD	0
Mission	SD	1215
Mission Hill	SD	176
Mitchell	SD	15669
Mobridge	SD	3466
Monroe	SD	155
Montrose	SD	463
Morningside	SD	105
Morristown	SD	70
Mound	SD	0
Mound City	SD	68
Mount Vernon	SD	442
Mountain Plains	SD	0
Murdo	SD	458
Naples	SD	38
New Effington	SD	258
New Elm Spring Colony	SD	0
New Holland	SD	76
New Underwood	SD	672
New Witten	SD	0
Newdale Colony	SD	0
Newell	SD	595
Newport Colony	SD	0
Nisland	SD	239
Norfeld Colony	SD	0
Norris	SD	152
North Eagle Butte	SD	1954
North Sioux	SD	0
North Sioux City	SD	2731
North Spearfish	SD	2285
Northville	SD	146
Nunda	SD	48
Oacoma	SD	473
Oahe Acres	SD	0
Oak Lane Colony	SD	0
Oelrichs	SD	122
Oglala	SD	1290
Okaton	SD	36
Okreek	SD	269
Ola	SD	13
Old Elm Spring Colony	SD	0
Oldham	SD	128
Olivet	SD	73
Onaka	SD	14
Onida	SD	658
Oral	SD	0
Orient	SD	63
Orland Colony	SD	0
Ortley	SD	66
Parker	SD	993
Parkston	SD	1488
Parmelee	SD	562
Pearl Creek Colony	SD	0
Peever	SD	169
Peever Flats	SD	0
Pembrook Colony	SD	0
Philip	SD	751
Pickstown	SD	221
Piedmont	SD	827
Pierpont	SD	129
Pierre	SD	14091
Pine Lakes Addition	SD	314
Pine Ridge	SD	3308
Plainview Colony	SD	0
Plankinton	SD	714
Platte	SD	1266
Platte Colony	SD	0
Pleasant Valley Colony	SD	0
Poinsett Colony	SD	0
Pollock	SD	229
Porcupine	SD	1062
Prairie	SD	0
Prairie City	SD	23
Prairiewood	SD	0
Presho	SD	503
Pringle	SD	109
Provo	SD	10
Pukwana	SD	282
Quinn	SD	57
Ramona	SD	194
Rapid	SD	0
Rapid City	SD	73569
Rapid Valley	SD	8260
Ravinia	SD	63
Raymond	SD	50
Redfield	SD	2379
Ree Heights	SD	61
Reliance	SD	218
Renner Corner	SD	305
Revillo	SD	114
Richland	SD	89
Riverside Colony	SD	0
Rockham	SD	32
Rockport Colony	SD	0
Rolland Colony	SD	0
Roscoe	SD	316
Rosebud	SD	1587
Rosedale Colony	SD	0
Rosholt	SD	427
Roslyn	SD	176
Roswell	SD	15
Rowena	SD	0
Running Water	SD	36
Rustic Acres Colony	SD	0
Saint Charles	SD	11
Saint Francis	SD	709
Saint Lawrence	SD	198
Saint Onge	SD	191
Salem	SD	1325
Scotland	SD	820
Selby	SD	634
Seneca	SD	37
Shamrock Colony	SD	0
Shannon Colony	SD	0
Sherman	SD	81
Shindler	SD	584
Sicangu	SD	0
Silver Lake Colony	SD	0
Sinai	SD	120
Sioux Falls	SD	171544
Sisseton	SD	2450
Smithwick	SD	0
Soldier Creek	SD	227
South Shore	SD	225
Spearfish	SD	11283
Spencer	SD	151
Spink Colony	SD	0
Spring Creek	SD	268
Spring Creek Colony	SD	0
Spring Lake Colony	SD	0
Spring Valley Colony	SD	0
Springfield	SD	1953
St. Charles	SD	0
St. Francis	SD	0
St. Lawrence	SD	0
St. Onge	SD	0
Stephan	SD	0
Stickney	SD	285
Stockholm	SD	103
Storla	SD	6
Strandburg	SD	69
Stratford	SD	73
Sturgis	SD	6688
Summerset	SD	2239
Summit	SD	291
Sunset Colony	SD	0
Swift Bird	SD	0
Tabor	SD	412
Tea	SD	4839
Thunderbird Colony	SD	0
Timber Lake	SD	483
Tolstoy	SD	36
Toronto	SD	210
Trent	SD	233
Tripp	SD	630
Tschetter Colony	SD	0
Tulare	SD	215
Turton	SD	48
Twin Brooks	SD	66
Two Strike	SD	209
Tyndall	SD	1049
Upland Colony	SD	0
Utica	SD	64
Vale	SD	136
Valley Springs	SD	767
Veblen	SD	537
Verdon	SD	5
Vermillion	SD	10738
Viborg	SD	762
Vienna	SD	44
Vilas	SD	18
Virgil	SD	17
Vivian	SD	119
Volga	SD	1865
Volin	SD	160
Wagner	SD	1589
Wakonda	SD	312
Wakpala	SD	0
Wall	SD	877
Wallace	SD	84
Wanblee	SD	725
Ward	SD	49
Warner	SD	482
Wasta	SD	82
Watertown	SD	22073
Waubay	SD	567
Waverly	SD	37
Webster	SD	1802
Wentworth	SD	193
Wessington	SD	181
Wessington Springs	SD	919
West Brule	SD	0
Westport	SD	134
Westwood Colony	SD	0
Wetonka	SD	8
White	SD	491
White Horse	SD	276
White Lake	SD	370
White River	SD	575
White Rock	SD	3
White Rock Colony	SD	0
Whitehorse	SD	141
Whitewood	SD	919
Willow Lake	SD	245
Wilmot	SD	504
Winfred	SD	52
Winner	SD	2825
Witten	SD	87
Wolf Creek Colony	SD	0
Wolsey	SD	398
Wonderland Homes	SD	0
Wood	SD	63
Woonsocket	SD	659
Worthing	SD	942
Wounded Knee	SD	382
Yale	SD	113
Yankton	SD	14557
Adams	TN	656
Adamsville	TN	2239
Alamo	TN	2487
Alcoa	TN	9316
Alexandria	TN	976
Algood	TN	3725
Allardt	TN	631
Altamont	TN	1027
Andersonville	TN	472
Apison	TN	2469
Ardmore	TN	1213
Arlington	TN	11625
Ashland	TN	0
Ashland City	TN	4649
Athens	TN	13688
Atoka	TN	9064
Atwood	TN	918
Auburntown	TN	269
Baileyton	TN	431
Baneberry	TN	482
Banner Hill	TN	1497
Bartlett	TN	58579
Baxter	TN	1384
Bean Station	TN	3104
Beech Bluff	TN	0
Beersheba Springs	TN	470
Bell Buckle	TN	517
Belle Meade	TN	3004
Bells	TN	2447
Belvidere	TN	0
Benton	TN	1292
Berry Hill	TN	547
Bethel Springs	TN	713
Bethpage	TN	288
Big Rock	TN	0
Big Sandy	TN	542
Biltmore	TN	0
Blaine	TN	1867
Blanche	TN	0
Bloomingdale	TN	9888
Blountville	TN	3074
Bluff	TN	0
Bluff City	TN	1723
Bogota	TN	0
Bolivar	TN	5093
Bon Air	TN	0
Bon Aqua Junction	TN	1230
Bowman	TN	302
Braden	TN	308
Bradford	TN	1011
Bransford	TN	170
Brentwood	TN	41763
Brentwood Estates	TN	31279
Briceville	TN	0
Brighton	TN	2996
Bristol	TN	26666
Brownsville	TN	9876
Bruceton	TN	1434
Buchanan	TN	0
Bulls Gap	TN	724
Burlison	TN	418
Burns	TN	1473
Butler	TN	0
Byrdstown	TN	814
Calhoun	TN	495
Camden	TN	3575
Carthage	TN	2278
Caryville	TN	2200
Castalian Springs	TN	556
Cedar Hill	TN	318
Celina	TN	1494
Centertown	TN	246
Centerville	TN	3584
Central	TN	2686
Chapel Hill	TN	1467
Charleston	TN	676
Charlotte	TN	1506
Chattanooga	TN	181099
Chesterfield	TN	469
Chewalla	TN	0
Childers Hill	TN	0
Christiana	TN	9830
Chuckey	TN	9560
Church Hill	TN	6719
Clarkrange	TN	575
Clarksburg	TN	380
Clarksville	TN	166722
Cleveland	TN	43898
Clifton	TN	2663
Clinton	TN	10049
Coalfield	TN	2463
Coalmont	TN	821
Coker Creek	TN	0
Collegedale	TN	10743
Collierville	TN	48863
Collinwood	TN	973
Colonial Heights	TN	6934
Columbia	TN	36800
Conasauga	TN	0
Condon	TN	1866
Cookeville	TN	32113
Coopertown	TN	4401
Copperhill	TN	328
Cordova	TN	68779
Cornersville	TN	1222
Cosby	TN	0
Cottage Grove	TN	88
Cottontown	TN	367
Counce	TN	0
Covington	TN	9036
Cowan	TN	1704
Crab Orchard	TN	759
Cross Plains	TN	1722
Crossville	TN	11411
Crump	TN	1400
Cumberland	TN	0
Cumberland City	TN	302
Cumberland Gap	TN	492
Dancyville	TN	0
Dandridge	TN	2924
Darden	TN	399
Dayton	TN	7384
Decatur	TN	1575
Decaturville	TN	869
Decherd	TN	2424
Delano	TN	0
Dellrose	TN	0
Dickson	TN	15359
Dodson Branch	TN	1074
Dover	TN	1457
Dowelltown	TN	362
Doyle	TN	545
Dresden	TN	2898
Ducktown	TN	453
Dukedom	TN	0
Dunlap	TN	5108
Dyer	TN	2274
Dyersburg	TN	16781
Eagleton	TN	0
Eagleton Village	TN	5052
Eagleville	TN	651
East Brainerd	TN	15114
East Chattanooga	TN	154024
East Cleveland	TN	1608
East Ridge	TN	20979
Eastview	TN	697
Elgin	TN	282
Elizabethton	TN	13772
Elkton	TN	565
Ellendale	TN	25882
Embreeville	TN	0
Englewood	TN	1611
Enville	TN	191
Erin	TN	1295
Erwin	TN	5979
Essary Springs	TN	0
Estill Springs	TN	2044
Ethridge	TN	474
Etowah	TN	3500
Eva	TN	293
Fair Garden	TN	529
Fairfield	TN	131
Fairfield Glade	TN	6989
Fairgarden	TN	0
Fairmount	TN	2825
Fairview	TN	8331
Fall Branch	TN	1291
Falling Water	TN	1232
Farner	TN	0
Farragut	TN	21919
Fayetteville	TN	7121
Fincastle	TN	1618
Finger	TN	297
Finley	TN	0
Flat Top Mountain	TN	422
Flintville	TN	627
Forest Hills	TN	5039
Fowlkes	TN	0
Frankewing	TN	0
Franklin	TN	72639
Friendship	TN	668
Friendsville	TN	920
Gadsden	TN	469
Gainesboro	TN	955
Gallatin	TN	34334
Gallaway	TN	658
Garland	TN	320
Gates	TN	627
Gatlinburg	TN	4184
Germantown	TN	39240
Gibson	TN	374
Gilt Edge	TN	476
Gladeville	TN	0
Gleason	TN	1407
Goodlettsville	TN	16994
Gordonsville	TN	1204
Graball	TN	236
Grand Junction	TN	303
Gray	TN	1222
Graysville	TN	1515
Green Hill	TN	6618
Greenback	TN	1110
Greenbrier	TN	6745
Greeneville	TN	15094
Greenfield	TN	2120
Greenvale	TN	0
Griffith Creek	TN	0
Grimsley	TN	1167
Gruetli-Laager	TN	1776
Guys	TN	464
Halls	TN	2178
Hampton	TN	0
Harriman	TN	6224
Harrison	TN	7769
Harrogate	TN	4388
Hartsville	TN	2435
Hartsville/Trousdale County	TN	0
Helenwood	TN	865
Henderson	TN	6552
Hendersonville	TN	56018
Henning	TN	916
Henry	TN	467
Hermitage	TN	37814
Hickman	TN	0
Hickory Valley	TN	93
Hickory Withe	TN	2973
Hilham	TN	0
Hillsboro	TN	450
Hohenwald	TN	3667
Holladay	TN	0
Hollow Rock	TN	697
Hopewell	TN	1874
Hornbeak	TN	409
Hornsby	TN	280
Humboldt	TN	8313
Hunter	TN	1854
Huntingdon	TN	3926
Huntland	TN	855
Huntsville	TN	1233
Huron	TN	0
Iron	TN	0
Iron City	TN	328
Jacks Creek	TN	0
Jacksboro	TN	1951
Jackson	TN	66975
Jamestown	TN	1947
Jasper	TN	3312
Jefferson	TN	0
Jefferson City	TN	8504
Jellico	TN	2262
John Sevier	TN	0
Johnson	TN	0
Johnson City	TN	66027
Johnsonville	TN	1748
Jonesborough	TN	5291
Kahite	TN	0
Karns	TN	0
Kenton	TN	1224
Kimball	TN	1401
Kingsport	TN	53014
Kingston	TN	5846
Kingston Springs	TN	2770
Knoxville	TN	190740
La Follette	TN	0
La Grange	TN	131
La Vergne	TN	34794
Lafayette	TN	4991
LaFollette	TN	7456
Lake Tansi	TN	3803
Lakeland	TN	12553
Lakesite	TN	1865
Lakewood	TN	2302
Lakewood Park	TN	990
Lavinia	TN	0
Lawrenceburg	TN	10569
Lebanon	TN	30262
Lenoir	TN	0
Lenoir City	TN	9091
Lenox	TN	0
Leoma	TN	0
Lewisburg	TN	11480
Lexington	TN	7822
Liberty	TN	316
Linden	TN	908
Livingston	TN	4071
Lobelville	TN	898
Lone Oak	TN	1206
Lookout Mountain	TN	1884
Loretto	TN	1747
Loudon	TN	5731
Louisville	TN	4092
Luray	TN	0
Luttrell	TN	1082
Lyles	TN	734
Lynchburg	TN	6132
Lynchburg, Moore County	TN	0
Lynnville	TN	297
Madisonville	TN	4783
Manchester	TN	10517
Martin	TN	10959
Maryville	TN	28464
Mascot	TN	2411
Mason	TN	1597
Maury	TN	0
Maury City	TN	675
Mayland	TN	0
Maynardville	TN	2355
McDonald	TN	0
McEwen	TN	1703
McKenzie	TN	5296
McLemoresville	TN	344
McMinnville	TN	13759
Medina	TN	4124
Medon	TN	173
Memphis	TN	633104
Mercer	TN	0
Michie	TN	589
Middle Valley	TN	12684
Middleton	TN	660
Midtown	TN	1360
Midway	TN	2491
Milan	TN	7813
Milledgeville	TN	265
Millersville	TN	6700
Millington	TN	11027
Minor Hill	TN	527
Miston	TN	0
Mitchellville	TN	200
Monteagle	TN	1177
Monterey	TN	2860
Mooresburg	TN	941
Morris Chapel	TN	0
Morrison	TN	699
Morristown	TN	29478
Moscow	TN	532
Mosheim	TN	2343
Mount Carmel	TN	5425
Mount Juliet	TN	31540
Mount Pleasant	TN	4790
Mountain	TN	0
Mountain City	TN	2475
Mowbray Mountain	TN	1615
Munford	TN	6108
Murfreesboro	TN	165430
Nashville	TN	689447
Nashville-Davidson	TN	0
New Deal	TN	368
New Hope	TN	1067
New Johnsonville	TN	1897
New Market	TN	1365
New South Memphis	TN	641608
New Tazewell	TN	2957
New Union	TN	1431
Newbern	TN	3336
Newport	TN	6834
Niota	TN	718
Nixon	TN	0
Nolensville	TN	6939
Norene	TN	0
Normandy	TN	148
Norris	TN	1651
Oak Grove	TN	4425
Oak Hill	TN	4700
Oak Ridge	TN	29302
Oakdale	TN	216
Oakland	TN	7488
Obion	TN	1074
Ocoee	TN	0
Oliver Springs	TN	3237
Olivet	TN	1350
Oneida	TN	3709
Ooltewah	TN	687
Orebank	TN	0
Orlinda	TN	887
Orme	TN	123
Palmer	TN	662
Palmersville	TN	0
Paris	TN	10150
Park	TN	0
Park City	TN	2442
Parker Crossroads	TN	241
Parker's Crossroads	TN	0
Parrottsville	TN	261
Parsons	TN	2337
Pegram	TN	2108
Pelham	TN	403
Petersburg	TN	548
Petros	TN	583
Philadelphia	TN	688
Pigeon Forge	TN	6171
Pikeville	TN	1636
Pine Crest	TN	2633
Pinson	TN	0
Piperton	TN	1629
Pittman Center	TN	565
Plainview	TN	2061
Pleasant Hill	TN	600
Pleasant View	TN	4295
Pocahontas	TN	0
Portland	TN	12323
Powell	TN	0
Powells Crossroads	TN	1317
Prospect	TN	0
Pulaski	TN	7617
Puryear	TN	669
Ramer	TN	318
Randolph	TN	0
Rarity Bay	TN	0
Red Bank	TN	11769
Red Boiling Springs	TN	1140
Riceville	TN	670
Ridgely	TN	1706
Ridgeside	TN	390
Ridgetop	TN	2042
Ripley	TN	8176
Rives	TN	316
Roan Mountain	TN	1360
Robbins	TN	287
Rockford	TN	858
Rockvale	TN	0
Rockwood	TN	5425
Rocky Top	TN	1781
Rogersville	TN	4383
Rossville	TN	768
Rural Hill	TN	2007
Russellville	TN	0
Rutherford	TN	1109
Rutledge	TN	1187
Saint Joseph	TN	782
Sale Creek	TN	2845
Saltillo	TN	505
Samburg	TN	210
Sardis	TN	381
Saulsbury	TN	94
Savannah	TN	7027
Scotts Hill	TN	984
Selmer	TN	4488
Sequatchie	TN	0
Sevierville	TN	16490
Sewanee	TN	2311
Seymour	TN	10919
Shackle Island	TN	2844
Sharon	TN	916
Shelbyville	TN	21317
Sherwood	TN	0
Shiloh	TN	0
Signal Mountain	TN	8528
Silerton	TN	104
Slayden	TN	181
Smithville	TN	4640
Smyrna	TN	46607
Sneedville	TN	1346
Soddy-Daisy	TN	13171
Somerville	TN	3094
South Carthage	TN	1334
South Cleveland	TN	6912
South Fulton	TN	2261
South Pittsburg	TN	3114
Sparta	TN	5096
Speedwell	TN	4278
Spencer	TN	1634
Spring	TN	0
Spring City	TN	1995
Spring Hill	TN	36055
Springfield	TN	16808
Spurgeon	TN	3957
St. Joseph	TN	0
Stanton	TN	427
Stantonville	TN	282
Statesville	TN	0
Strawberry Plains	TN	0
Sullivan Gardens	TN	0
Summertown	TN	866
Sunbright	TN	545
Surgoinsville	TN	1788
Sweetwater	TN	5931
Taft	TN	0
Tazewell	TN	2288
Telford	TN	921
Tellico	TN	0
Tellico Plains	TN	942
Tellico Village	TN	5791
Tennessee Ridge	TN	1329
Thompson's Station	TN	3801
Three Way	TN	1681
Tiptonville	TN	4352
Toone	TN	343
Townsend	TN	452
Tracy	TN	0
Tracy City	TN	1440
Trenton	TN	4134
Trezevant	TN	841
Tri-Cities	TN	1
Trimble	TN	623
Troy	TN	1318
Tuckers Crossroads	TN	0
Tullahoma	TN	19128
Tusculum	TN	2666
Unicoi	TN	3561
Union	TN	0
Union City	TN	10573
Unionville	TN	1368
Valley Forge	TN	0
Vanleer	TN	402
Viola	TN	133
Vonore	TN	1493
Walden	TN	2063
Walland	TN	259
Walnut Grove	TN	864
Walnut Hill	TN	2394
Walterhill	TN	401
Wartburg	TN	904
Wartrace	TN	659
Watauga	TN	444
Watertown	TN	1517
Waverly	TN	4090
Waynesboro	TN	2390
Westmoreland	TN	2291
Westpoint	TN	0
White Bluff	TN	3402
White House	TN	11226
White Pine	TN	2244
Whiteoak Hollow	TN	17
Whiteside	TN	0
Whiteville	TN	4523
Whitlock	TN	0
Whitwell	TN	1725
Wildersville	TN	0
Wildwood	TN	1098
Wildwood Lake	TN	3124
Williston	TN	384
Winchester	TN	8539
Winfield	TN	951
Woodbury	TN	2762
Woodland Mills	TN	366
Wrigley	TN	281
Wynnburg	TN	0
Yorkville	TN	278
Yuma	TN	0
Abbott	TX	358
Abernathy	TX	2743
Abilene	TX	125182
Abram	TX	2067
Acala	TX	11
Ackerly	TX	231
Addison	TX	15518
Adrian	TX	167
Agua Dulce	TX	3014
Aguilares	TX	21
Airport Heights	TX	0
Airport Road Addition	TX	93
Alamo	TX	19246
Alamo Beach	TX	0
Alamo Heights	TX	8038
Alanreed	TX	0
Alba	TX	510
Albany	TX	2014
Aldine	TX	15869
Aledo	TX	3412
Alfred	TX	91
Alice	TX	19408
Alice Acres	TX	490
Alief	TX	98725
Allen	TX	98143
Allison	TX	0
Alma	TX	339
Alpine	TX	5952
Alto	TX	1223
Alto Bonito	TX	569
Alto Bonito Colonia	TX	624
Alto Bonito Heights	TX	0
Alton	TX	15760
Alton North (historical)	TX	5541
Alvarado	TX	4015
Alvin	TX	25791
Alvord	TX	1403
Amada Acres	TX	0
Amargosa	TX	0
Amargosa Colonia	TX	291
Amarillo	TX	198645
Amaya	TX	0
Amaya Colonia	TX	93
Ames	TX	1171
Amherst	TX	683
Amistad	TX	0
Amistad Acres	TX	53
Anacua	TX	0
Anahuac	TX	2324
Anderson	TX	229
Anderson Mill	TX	8744
Andrews	TX	13816
Angleton	TX	19429
Angus	TX	415
Anna	TX	11463
Annetta	TX	1442
Annetta North	TX	573
Annetta South	TX	558
Annona	TX	303
Anson	TX	2334
Anthony	TX	5517
Anton	TX	1128
Appleby	TX	472
Aquilla	TX	108
Aransas Pass	TX	8530
Archer	TX	0
Archer City	TX	1754
Arcola	TX	1668
Argyle	TX	3905
Arlington	TX	388125
Arp	TX	996
Arroyo Alto	TX	351
Arroyo Colorado Estates	TX	0
Arroyo Colorado Estates Colonia	TX	997
Arroyo Gardens	TX	456
Asherton	TX	1084
Aspermont	TX	868
Atascocita	TX	65844
Athens	TX	12788
Atlanta	TX	5605
Aubrey	TX	3352
Aurora	TX	1307
Austin	TX	974447
Austwell	TX	149
Avery	TX	459
Avinger	TX	440
Azle	TX	11693
B and E	TX	0
B and E Colonia	TX	518
Bacliff	TX	8619
Bailey	TX	286
Bailey Prairie	TX	727
Bailey's Prairie	TX	0
Baird	TX	1483
Balch Springs	TX	25210
Balcones Heights	TX	3254
Ballinger	TX	3767
Balmorhea	TX	523
Bandera	TX	877
Bangs	TX	1581
Banquete	TX	726
Bardwell	TX	675
Barksdale	TX	0
Barrera	TX	0
Barrett	TX	3199
Barry	TX	242
Barstow	TX	379
Bartlett	TX	2761
Barton Creek	TX	3077
Bartonville	TX	1680
Bastrop	TX	8231
Batesville	TX	1068
Bay	TX	0
Bay City	TX	17598
Bayou Vista	TX	1592
Bayside	TX	331
Baytown	TX	76335
Bayview	TX	419
Beach	TX	0
Beach City	TX	2566
Bear Creek	TX	388
Bear Creek Ranch	TX	0
Beasley	TX	665
Beaumont	TX	115282
Beauxart Gardens	TX	0
Beaver Creek	TX	0
Beckville	TX	843
Bedford	TX	49337
Bedias	TX	455
Bee Cave	TX	6292
Beeville	TX	13277
Bellaire	TX	18518
Bellevue	TX	348
Bellmead	TX	10164
Bells	TX	1426
Bellville	TX	4262
Belterra	TX	0
Belton	TX	20547
Ben Arnold	TX	0
Ben Bolt	TX	0
Ben Wheeler	TX	0
Benavides	TX	1317
Benbrook	TX	22629
Benjamin	TX	267
Benjamin Perez	TX	0
Berryville	TX	1014
Bertram	TX	1390
Beverly	TX	2162
Beverly Hills	TX	2033
Bevil Oaks	TX	1245
Big Lake	TX	3315
Big Sandy	TX	1374
Big Spring	TX	28862
Big Thicket Lake Estates	TX	0
Big Wells	TX	762
Bigfoot	TX	450
Bishop	TX	3150
Bishop Hills	TX	186
Bivins	TX	0
Bixby	TX	504
Blackwell	TX	311
Blanco	TX	1889
Blanket	TX	383
Bledsoe	TX	0
Blessing	TX	927
Bloomburg	TX	398
Blooming Grove	TX	824
Bloomington	TX	2459
Blossom	TX	1551
Blue Berry Hill	TX	866
Blue Mound	TX	2490
Blue Ridge	TX	917
Bluetown	TX	356
Bluetown Colonia	TX	356
Bluff Dale	TX	0
Blum	TX	441
Boerne	TX	13674
Bogata	TX	1111
Boling	TX	1122
Bolivar Peninsula	TX	2417
Bonanza Hills	TX	37
Bonham	TX	10079
Bonney	TX	340
Booker	TX	1636
Borger	TX	12964
Botines	TX	117
Bovina	TX	1769
Bowie	TX	5126
Box Canyon	TX	0
Boyd	TX	1335
Boys Ranch	TX	282
Brackettville	TX	1655
Brady	TX	5549
Brazoria	TX	3071
Brazos	TX	0
Brazos Bend	TX	323
Brazos Country	TX	484
Breckenridge	TX	5590
Bremond	TX	920
Brenham	TX	16579
Briar	TX	5665
Briarcliff	TX	1510
Briaroaks	TX	496
Bridge	TX	0
Bridge City	TX	7941
Bridgeport	TX	6381
Briggs	TX	0
Bristol	TX	668
Broaddus	TX	197
Bronson	TX	287
Bronte	TX	972
Brookshire	TX	5120
Brookside	TX	0
Brookside Village	TX	1570
Brookston	TX	0
Browndell	TX	197
Brownfield	TX	9736
Brownsboro	TX	1073
Brownsville	TX	186738
Brownwood	TX	19031
Bruceville-Eddy	TX	1497
Brundage	TX	27
Bruni	TX	379
Brushy Creek	TX	21764
Bryan	TX	82118
Bryson	TX	528
Buchanan Dam	TX	1519
Buchanan Lake	TX	0
Buchanan Lake Village	TX	692
Buckholts	TX	509
Buckingham	TX	66
Buda	TX	13705
Buena Vista	TX	0
Buena Vista Colonia	TX	102
Buffalo	TX	1887
Buffalo Gap	TX	470
Buffalo Springs	TX	454
Buffalo Springs Lake	TX	0
Bullard	TX	2832
Bulverde	TX	4925
Buna	TX	2142
Bunker Hill	TX	0
Bunker Hill Village	TX	3957
Burkburnett	TX	11043
Burke	TX	735
Burleson	TX	43625
Burlington	TX	0
Burnet	TX	6239
Burton	TX	303
Bushland	TX	1500
Butterfield	TX	114
Byers	TX	477
Bynum	TX	199
CÃ©sar ChÃ¡vez	TX	0
Cactus	TX	3197
Caddo Mills	TX	1470
Cade Lakes	TX	0
Caldwell	TX	4283
Callender Lake	TX	0
Callisburg	TX	363
Calvert	TX	1151
Camargito	TX	0
Cameron	TX	5460
Cameron Park	TX	6963
Cameron Park Colonia	TX	6963
Camp Swift	TX	6383
Camp Wood	TX	701
Campbell	TX	656
Campo Verde	TX	0
Canadian	TX	3013
Caney	TX	0
Caney City	TX	217
Canton	TX	3752
Cantu Addition	TX	188
Canutillo	TX	6321
Canyon	TX	14887
Canyon Creek	TX	0
Canyon Lake	TX	21262
Cape Royale	TX	0
Carbon	TX	266
Carl's Corner	TX	0
Carls Corner	TX	173
Carlsbad	TX	719
Carlton	TX	0
Carmine	TX	257
Carrizo Hill	TX	582
Carrizo Springs	TX	5898
Carrollton	TX	133168
Carter	TX	0
Carthage	TX	6844
Casa Blanca	TX	54
Casas	TX	0
Cashion Community	TX	343
Castle Hills	TX	4424
Castroville	TX	2931
Catarina	TX	118
Cedar Creek	TX	0
Cedar Hill	TX	48507
Cedar Park	TX	65945
Cedar Point	TX	0
Celeste	TX	836
Celina	TX	64427
Center	TX	5727
Center Point	TX	0
Centerville	TX	903
Central Gardens	TX	4347
César Chávez	TX	1929
Chandler	TX	2949
Channelview	TX	38289
Channing	TX	360
Chaparrito	TX	0
Chapeno	TX	0
Charlotte	TX	1815
Chester	TX	310
Chico	TX	1069
Childress	TX	6101
Chillicothe	TX	660
Chilton	TX	911
China	TX	1130
China Grove	TX	1291
China Spring	TX	0
Chireno	TX	386
Christine	TX	414
Christoval	TX	504
Chula Vista	TX	0
Chula Vista Colonia	TX	450
Cibolo	TX	33433
Cienegas Terrace	TX	3424
Cinco Ranch	TX	18274
Circle D-KC Estates	TX	2393
Cisco	TX	3791
Citrus	TX	0
Citrus City	TX	2321
Clarendon	TX	1944
Clarksville	TX	3187
Clarksville City	TX	879
Claude	TX	1224
Clay	TX	0
Clear Lake Shores	TX	1169
Cleburne	TX	30020
Cleveland	TX	7858
Clifton	TX	3361
Clint	TX	1146
Cloverleaf	TX	22942
Clute	TX	11444
Clyde	TX	3771
Coahoma	TX	887
Cockrell Hill	TX	4316
Coffee	TX	0
Coffee City	TX	279
Coldspring	TX	899
Coleman	TX	4393
College Station	TX	107889
Colleyville	TX	25487
Collinsville	TX	1687
Colmesneil	TX	584
Colonia Iglesia Antigua	TX	413
Colorado	TX	0
Colorado Acres	TX	0
Colorado City	TX	4117
Columbus	TX	3629
Comanche	TX	4197
Combes	TX	3059
Combine	TX	2107
Comfort	TX	2363
Commerce	TX	8892
Como	TX	706
Concepcion	TX	62
Conroe	TX	68602
Converse	TX	21987
Cool	TX	167
Coolidge	TX	950
Cooper	TX	2180
Coppell	TX	41159
Copper Canyon	TX	1431
Copperas Cove	TX	33081
Corinth	TX	20998
Corpus Christi	TX	316239
Corral	TX	0
Corral City	TX	28
Corrigan	TX	1539
Corsicana	TX	23952
Cottonwood	TX	202
Cottonwood Shores	TX	1158
Cotulla	TX	4216
Coupland	TX	300
Cove	TX	509
Covington	TX	269
Coyanosa	TX	163
Coyote Acres	TX	508
Coyote Acres Colonia	TX	427
Coyote Flats	TX	0
Crandall	TX	3238
Crane	TX	3895
Cranfills Gap	TX	276
Crawford	TX	741
Creedmoor	TX	221
Cresson	TX	788
Crockett	TX	6554
Crosby	TX	2299
Crosbyton	TX	1699
Cross Mountain	TX	3124
Cross Plains	TX	970
Cross Roads	TX	840
Cross Timber	TX	268
Crowell	TX	866
Crowley	TX	14853
Crystal	TX	0
Crystal City	TX	7496
Cuero	TX	7115
Cuevitas	TX	40
Cumby	TX	790
Cumings	TX	981
Cuney	TX	141
Cushing	TX	612
Cut and Shoot	TX	1105
Cypress	TX	200839
D'Hanis	TX	847
Daingerfield	TX	2452
Daisetta	TX	991
Dalhart	TX	8370
Dallas	TX	1326087
Dalworthington Gardens	TX	2373
Damon	TX	552
Danbury	TX	1776
Darrouzett	TX	384
Dawson	TX	801
Dayton	TX	7575
Dayton Lakes	TX	97
De Kalb	TX	1657
De Leon	TX	2150
Dean	TX	475
Deanville	TX	0
Decatur	TX	6521
DeCordova	TX	2855
Deer Park	TX	33806
Deerwood	TX	0
Del Mar Heights	TX	113
Del Rio	TX	36153
Del Sol	TX	0
Del Sol Colonia	TX	239
Dell	TX	0
Dell City	TX	353
Delmita	TX	216
Denison	TX	23150
Dennis	TX	0
Denton	TX	131044
Denver	TX	0
Denver City	TX	4864
Deport	TX	566
DeSoto	TX	52486
Detroit	TX	705
Devers	TX	457
Devine	TX	4705
Deweyville	TX	1023
Diboll	TX	5400
Dickens	TX	255
Dickinson	TX	19895
Dilley	TX	4223
Dime Box	TX	0
Dimmitt	TX	4195
DISH	TX	387
Dodd	TX	0
Dodd City	TX	365
Dodson	TX	109
Doffing	TX	5091
Domino	TX	93
Donna	TX	16523
Doolittle	TX	2769
Dorchester	TX	89
Double Horn	TX	0
Double Oak	TX	3078
Douglassville	TX	227
Doyle	TX	313
Driftwood	TX	144
Dripping Springs	TX	2483
Driscoll	TX	752
Dublin	TX	3664
Dumas	TX	15001
Duncanville	TX	39826
E. Lopez	TX	0
Eagle Lake	TX	3650
Eagle Mountain	TX	7003
Eagle Pass	TX	28765
Early	TX	2833
Earth	TX	1012
East Alto Bonito	TX	0
East Bernard	TX	2304
East Columbia	TX	0
East Lopez	TX	166
East Mountain	TX	814
East Tawakoni	TX	901
Eastland	TX	3825
Easton	TX	501
Ector	TX	693
Edcouch	TX	3316
Eden	TX	2786
Edgecliff	TX	0
Edgecliff Village	TX	2970
Edgewater Estates	TX	72
Edgewater-Paisano	TX	200
Edgewood	TX	1450
Edinburg	TX	84497
Edmonson	TX	105
Edna	TX	5792
Edom	TX	378
Edroy	TX	331
Eidson Road	TX	8960
El Brazil	TX	47
El Camino Angosto	TX	253
El Campo	TX	11604
El Castillo	TX	0
El Cenizo	TX	3273
El Cenizo Colonia	TX	249
El Chaparral	TX	0
El Indio	TX	190
El Lago	TX	2706
El Mesquite	TX	0
El Paso	TX	678815
El Quiote	TX	0
El Rancho Vela	TX	0
El Refugio	TX	331
El Refugio Colonia	TX	242
El Socio	TX	0
Elbert	TX	30
Eldorado	TX	1810
Electra	TX	2711
Elgin	TX	9039
Elias-Fela Solis	TX	30
Elkhart	TX	1317
Ellinger	TX	203
Elm Creek	TX	2469
Elmendorf	TX	1688
Elmo	TX	768
Elsa	TX	6647
Emerald Bay	TX	0
Emhouse	TX	135
Emory	TX	1253
Encantada-Ranchito-El Calaboz	TX	2255
Enchanted Oaks	TX	334
Encinal	TX	592
Encino	TX	143
Ennis	TX	19007
Escobar I	TX	324
Escobares	TX	2451
Estelline	TX	136
Eugenio Saenz	TX	0
Euless	TX	54219
Eureka	TX	311
Eustace	TX	988
Evadale	TX	1483
Evant	TX	411
Evergreen	TX	0
Evergreen Colonia	TX	73
Everman	TX	6352
Fabens	TX	8257
Fabrica	TX	0
Fair Oaks Ranch	TX	7407
Fairchilds	TX	1027
Fairfield	TX	2912
Fairview	TX	10372
Falcon	TX	0
Falcon Heights	TX	53
Falcon Lake Estates	TX	1036
Falcon Mesa	TX	405
Falcon Village	TX	47
Falconaire	TX	0
Falfurrias	TX	4962
Falls	TX	0
Falls City	TX	660
Falman	TX	76
Fannett	TX	2252
Farmers Branch	TX	32689
Farmersville	TX	3447
Farnsworth	TX	0
Farwell	TX	1311
Fate	TX	9847
Fayetteville	TX	263
Faysville	TX	439
Fernando Salinas	TX	15
Ferris	TX	2534
Fifth Street	TX	2486
Flat	TX	0
Flatonia	TX	1401
Flor del Rio	TX	0
Florence	TX	1231
Floresville	TX	7321
Flowella	TX	118
Flower Mound	TX	71253
Floydada	TX	2775
Fluvanna	TX	0
Follett	TX	494
Forest Heights	TX	0
Forest Hill	TX	12881
Forney	TX	18418
Forsan	TX	226
Fort Bliss	TX	8591
Fort Cavazos	TX	29589
Fort Clark Springs	TX	1228
Fort Davis	TX	1201
Fort Gates	TX	913
Fort Hancock	TX	1750
Fort Hood	TX	0
Fort Stockton	TX	8649
Fort Worth	TX	1008106
Four Corners	TX	12382
Four Points	TX	0
Four Points Colonia	TX	18
Fowlerton	TX	55
Franklin	TX	1610
Frankston	TX	1174
Fredericksburg	TX	11094
Freeport	TX	12154
Freer	TX	2732
Fresno	TX	19069
Friendswood	TX	38800
Friona	TX	3894
Frisco	TX	154407
Fritch	TX	2066
Fronton	TX	180
Fronton Ranchettes	TX	0
Frost	TX	651
Fruitvale	TX	413
Fulshear	TX	5886
Fulton	TX	1541
Gail	TX	231
Gainesville	TX	16292
Galena Park	TX	11162
Gallatin	TX	421
Galveston	TX	50180
Ganado	TX	2095
Garceno	TX	420
Garciasville	TX	46
Garden	TX	0
Garden City	TX	334
Garden Ridge	TX	3850
Gardendale	TX	1574
Garfield	TX	1698
Garland	TX	236897
Garner	TX	0
Garrett	TX	822
Garrison	TX	897
Garwood	TX	0
Gary	TX	0
Gary City	TX	305
Garza-Salinas II	TX	719
Gatesville	TX	15724
Gause	TX	0
George West	TX	2631
Georgetown	TX	63716
Geronimo	TX	1032
Gholson	TX	1076
Giddings	TX	5064
Gilmer	TX	5187
Girard	TX	50
Gladewater	TX	6432
Glazier	TX	0
Glen Rose	TX	2580
Glenn Heights	TX	12042
Glidden	TX	661
Godley	TX	1069
Goldsmith	TX	279
Goldthwaite	TX	1860
Goliad	TX	1986
Golinda	TX	557
Gonzales	TX	7544
Goodlow	TX	0
Goodlow Park	TX	200
Goodrich	TX	263
Gordon	TX	471
Goree	TX	211
Gorman	TX	1051
Graford	TX	575
Graham	TX	8865
Granbury	TX	9386
Grand Acres	TX	49
Grand Prairie	TX	187809
Grand Saline	TX	3131
Grandfalls	TX	391
Grandview	TX	1615
Granger	TX	1517
Grangerland	TX	0
Granite Shoals	TX	5071
Granjeno	TX	299
Grape Creek	TX	3154
Grapeland	TX	1417
Grapevine	TX	51404
Grayburg	TX	297
Grays Prairie	TX	363
Greatwood	TX	11538
Green Valley Farms	TX	1272
Greenville	TX	26515
Gregory	TX	1992
Grey Forest	TX	515
Groesbeck	TX	4304
Groom	TX	558
Groves	TX	15750
Groveton	TX	1024
Gruver	TX	1190
Guadalupe Guerra	TX	0
Guerra	TX	6
Gun Barrel	TX	0
Gun Barrel City	TX	5985
Gunter	TX	1666
Gustine	TX	455
Guthrie	TX	160
Gutierrez	TX	0
H. Cuellar Estates	TX	0
Hackberry	TX	1037
Hale Center	TX	2093
Hallettsville	TX	2592
Hallsburg	TX	522
Hallsville	TX	4065
Haltom	TX	0
Haltom City	TX	44206
Hamilton	TX	2937
Hamlin	TX	2042
Hamshire	TX	0
Happy	TX	656
Hardin	TX	866
Harding Gill Tract	TX	0
Hargill	TX	877
Harker Heights	TX	29142
Harlingen	TX	65774
Harper	TX	1192
Harrold	TX	0
Hart	TX	1044
Hartley	TX	540
Harwood	TX	0
Haskell	TX	3226
Haslet	TX	1786
Havana	TX	407
Hawk Cove	TX	494
Hawkins	TX	1291
Hawley	TX	614
Hays	TX	221
Hearne	TX	4456
Heartland	TX	0
Heath	TX	8211
Hebbronville	TX	4558
Hebron	TX	415
Hedley	TX	309
Hedwig	TX	0
Hedwig Village	TX	2557
Heidelberg	TX	1725
Helotes	TX	8591
Hemphill	TX	1218
Hempstead	TX	7110
Henderson	TX	13529
Henrietta	TX	3014
Hereford	TX	15021
Hermleigh	TX	345
Hewitt	TX	14252
Hickory Creek	TX	4139
Hico	TX	1326
Hidalgo	TX	13709
Hideaway	TX	3090
Higgins	TX	429
Highland	TX	0
Highland Haven	TX	452
Highland Park	TX	9189
Highland Village	TX	16149
Highlands	TX	7522
Hill Country	TX	0
Hill Country Village	TX	1067
Hillcrest	TX	730
Hillsboro	TX	8321
Hillside Acres	TX	0
Hilltop	TX	287
Hilltop Colonia	TX	77
Hilltop Lakes	TX	1101
Hilshire	TX	0
Hilshire Village	TX	811
Hitchcock	TX	7621
Holiday Beach	TX	514
Holiday Lakes	TX	1166
Holland	TX	1129
Holliday	TX	1706
Holly Lake Ranch	TX	2774
Hollywood Park	TX	3298
Homestead Meadows North	TX	5124
Homestead Meadows South	TX	7247
Hondo	TX	9119
Honey Grove	TX	1656
Hooks	TX	2744
Horizon	TX	0
Horizon City	TX	19288
Hornsby Bend	TX	6791
Horseshoe Bay	TX	3560
Horseshoe Bend	TX	0
Houston	TX	2314157
Howardwick	TX	378
Howe	TX	2798
Hubbard	TX	1370
Huckabay	TX	0
Hudson	TX	4821
Hudson Bend	TX	2981
Hudson Oaks	TX	2160
Hughes Springs	TX	1776
Hull	TX	669
Humble	TX	15665
Hungerford	TX	347
Hunters Creek	TX	0
Hunters Creek Village	TX	4756
Huntington	TX	2140
Huntsville	TX	40938
Hurst	TX	39016
Hutchins	TX	5727
Hutto	TX	22722
Huxley	TX	375
Iago	TX	161
Idalou	TX	2337
Iglesia Antigua	TX	0
Impact	TX	36
Imperial	TX	278
Indian Hills	TX	2591
Indian Lake	TX	642
Indian Springs	TX	785
Indio	TX	0
Industry	TX	317
Inez	TX	2098
Ingleside	TX	9695
Ingleside on the Bay	TX	0
Ingleside On-the-Bay	TX	615
Ingram	TX	1822
Iola	TX	413
Iowa Colony	TX	1170
Iowa Park	TX	6344
Iraan	TX	1287
Iredell	TX	334
Irving	TX	236607
Italy	TX	1897
Itasca	TX	1625
Ivanhoe	TX	0
J.F. Villareal	TX	0
Jacinto	TX	0
Jacinto City	TX	10782
Jacksboro	TX	4424
Jacksonville	TX	14884
Jamaica Beach	TX	1047
Jardin de San Julian	TX	0
Jarrell	TX	1171
Jasper	TX	7619
Jayton	TX	500
Jefferson	TX	2048
Jersey	TX	0
Jersey Village	TX	7900
Jewett	TX	1192
JF Villarreal	TX	104
Joaquin	TX	817
Johnson	TX	0
Johnson City	TX	1959
Jolly	TX	166
Jollyville	TX	16151
Jones Creek	TX	2074
Jonestown	TX	2033
Josephine	TX	1142
Joshua	TX	6066
Jourdanton	TX	4275
Juarez	TX	0
Junction	TX	2444
Justin	TX	3437
K-Bar Ranch	TX	358
Karnes	TX	0
Karnes City	TX	3371
Katy	TX	16158
Kaufman	TX	7156
Keene	TX	6181
Keller	TX	45758
Kemah	TX	1986
Kemp	TX	1256
Kempner	TX	1078
Kendleton	TX	393
Kenedy	TX	3421
Kenefick	TX	597
Kennard	TX	323
Kennedale	TX	7715
Kerens	TX	1572
Kermit	TX	6434
Kerrville	TX	23136
Kilgore	TX	14947
Killeen	TX	140806
Kingsbury	TX	782
Kingsland	TX	6030
Kingsville	TX	26225
Kirby	TX	8550
Kirbyville	TX	2132
Kirvin	TX	127
Knippa	TX	689
Knollwood	TX	443
Knox	TX	0
Knox City	TX	1183
Kopperl	TX	0
Kosse	TX	462
Kountze	TX	2083
Kress	TX	687
Krugerville	TX	1669
Krum	TX	4990
Kurten	TX	403
Kyle	TX	35733
La Blanca	TX	2488
La Carla	TX	0
La Casita	TX	128
La Chuparosa	TX	49
La Coma	TX	0
La Coma Heights	TX	0
La Coste	TX	1119
La Escondida	TX	0
La Esperanza	TX	0
La Feria	TX	7338
La Feria North	TX	212
La Grange	TX	4712
La Grulla	TX	1695
La Homa	TX	11985
La Joya	TX	4291
La Loma de Falcon	TX	95
La Marque	TX	15908
La Minita	TX	0
La Moca Ranch	TX	0
La Paloma	TX	2903
La Paloma Addition	TX	0
La Paloma Addition Colonia	TX	330
La Paloma Ranchettes	TX	239
La Paloma-Lost Creek	TX	408
La Porte	TX	35148
La Presa	TX	319
La Pryor	TX	1643
La Puerta	TX	632
La Rosita	TX	85
La Tina Ranch	TX	618
La Vernia	TX	1261
La Victoria	TX	171
La Villa	TX	2600
La Ward	TX	224
Lackland AFB	TX	0
Lackland Air Force Base	TX	9918
LaCoste	TX	0
Lacy-Lakeview	TX	6604
Ladonia	TX	605
Lago	TX	204
Lago Vista	TX	6550
Lago Vista Colonia	TX	115
Laguna Heights	TX	3488
Laguna Park	TX	1276
Laguna Seca	TX	266
Laguna Vista	TX	3212
Lake	TX	0
Lake Bridgeport	TX	361
Lake Brownwood	TX	1532
Lake Bryan	TX	0
Lake Cherokee	TX	0
Lake City	TX	518
Lake Colorado	TX	0
Lake Dallas	TX	7892
Lake Dunlap	TX	1934
Lake Jackson	TX	27533
Lake Kiowa	TX	1906
Lake Medina Shores	TX	0
Lake Meredith Estates	TX	0
Lake Tanglewood	TX	863
Lake View	TX	199
Lake Worth	TX	4822
Lakehills	TX	5150
Lakeport	TX	967
Lakeshore Gardens-Hidden Acres	TX	504
Lakeside	TX	1385
Lakeside City	TX	981
Lakeview	TX	101
Lakeway	TX	14217
Lakewood	TX	0
Lakewood Heights	TX	312
Lakewood Village	TX	560
Lamar	TX	636
Lamesa	TX	9427
Lamkin	TX	0
Lampasas	TX	7687
Lancaster	TX	38801
Lantana	TX	6874
Laredo	TX	256153
Laredo Ranchettes	TX	22
Laredo Ranchettes West	TX	0
Larga Vista	TX	814
Las Colonias	TX	310
Las Haciendas	TX	7
Las Lomas	TX	3147
Las Lomitas	TX	244
Las Palmas	TX	67
Las Palmas II	TX	1605
Las Pilas	TX	0
Las Quintas Fronterizas	TX	3290
Las Quintas Fronterizas Colonia	TX	3290
Lasana	TX	84
Lasara	TX	1039
Latexo	TX	308
Laughlin AFB	TX	0
Laughlin Air Force Base	TX	1569
Laureles	TX	3692
Lavon	TX	2889
Lawn	TX	320
Lawrence	TX	231
League	TX	0
League City	TX	98312
Leakey	TX	424
Leander	TX	59202
Leary	TX	483
Lefors	TX	507
Lelia Lake	TX	0
Leming	TX	946
Leon Valley	TX	11174
Leona	TX	177
Leonard	TX	1970
Leroy	TX	340
Levelland	TX	13914
Lewisville	TX	104039
Lexington	TX	1181
Liberty	TX	9039
Liberty City	TX	2351
Liberty Hill	TX	1389
Lincoln Park	TX	326
Lindale	TX	5692
Linden	TX	1979
Lindsay	TX	1078
Lingleville	TX	0
Linn	TX	801
Lipan	TX	452
Lipscomb	TX	37
Little Cypress	TX	0
Little Elm	TX	38341
Little River-Academy	TX	1959
Littlefield	TX	6090
Live Oak	TX	15346
Liverpool	TX	501
Livingston	TX	5172
Llano	TX	3341
Llano Grande	TX	3008
Lockett	TX	0
Lockhart	TX	13446
Lockney	TX	1689
Log Cabin	TX	717
Lolita	TX	555
Loma Grande	TX	0
Loma Grande Colonia	TX	107
Loma Linda	TX	0
Loma Linda Colonia	TX	122
Loma Linda East	TX	0
Loma Linda East Colonia	TX	254
Loma Linda West	TX	0
Loma Vista	TX	0
Loma Vista Colonia	TX	160
Lometa	TX	849
London	TX	180
Lone Oak	TX	628
Lone Star	TX	1631
Longoria	TX	0
Longview	TX	82287
Loop	TX	225
LopeÃ±o	TX	0
Lopeño	TX	174
Lopezville	TX	4333
Loraine	TX	603
Lorena	TX	1737
Lorenzo	TX	1171
Los Altos	TX	0
Los Altos Colonia	TX	140
Los Alvarez	TX	303
Los Angeles	TX	121
Los Arcos	TX	0
Los Arrieros	TX	0
Los Barreras	TX	288
Los Centenarios	TX	0
Los Corralitos	TX	0
Los Ebanos	TX	335
Los Ebanos Colonia	TX	280
Los Fresnos	TX	6582
Los Huisaches	TX	0
Los Indios	TX	1114
Los Lobos	TX	9
Los Minerales	TX	0
Los Nopalitos	TX	0
Los Veteranos I	TX	24
Los Veteranos II	TX	24
Los Villareales	TX	24
Los Ybanez	TX	19
Lost Creek	TX	4509
Lott	TX	726
Louise	TX	995
Lovelady	TX	620
Loving	TX	0
Lowry Crossing	TX	1780
Lozano	TX	404
Lubbock	TX	249042
Lucas	TX	6883
Lueders	TX	336
Luella	TX	581
Lufkin	TX	36333
Luling	TX	5764
Lumberton	TX	12421
Lyford	TX	2607
Lyons	TX	0
Lytle	TX	2869
Mabank	TX	3309
Macdona	TX	559
Madisonville	TX	4637
Magnolia	TX	1828
Magnolia Beach	TX	0
Malakoff	TX	2296
Malone	TX	267
Manchaca	TX	1133
Manor	TX	7587
Mansfield	TX	64274
Manuel Garcia	TX	0
Manuel Garcia II	TX	77
Manvel	TX	7950
Marathon	TX	430
Marble Falls	TX	6281
Marfa	TX	1733
Marietta	TX	133
Marion	TX	1111
Markham	TX	1082
Marlin	TX	5682
Marquez	TX	265
Marshall	TX	23820
Marshall Creek	TX	504
Mart	TX	1910
Martindale	TX	1216
Martinez	TX	0
Mason	TX	2139
Matador	TX	581
Matagorda	TX	503
Mathis	TX	5037
Maud	TX	1071
Mauriceville	TX	3252
May	TX	0
Maypearl	TX	981
McAllen	TX	140269
McCamey	TX	2062
McCaulley	TX	0
McDade	TX	685
McGregor	TX	5064
McKinney	TX	162898
McKinney Acres	TX	815
McLean	TX	797
McLendon-Chisholm	TX	2210
McLeod	TX	0
McQueeney	TX	2545
Meadow	TX	593
Meadowlakes	TX	1872
Meadows Place	TX	4759
Medina	TX	3935
Megargel	TX	194
Melissa	TX	7436
Melvin	TX	180
Memphis	TX	2138
Menard	TX	1420
Mentone	TX	19
Mercedes	TX	16657
Meridian	TX	1427
Merkel	TX	2615
Mertens	TX	124
Mertzon	TX	758
Mesquite	TX	144788
Mexia	TX	7406
Mi Ranchito Estate	TX	281
Miami	TX	589
Midfield	TX	0
Midland	TX	132524
Midlothian	TX	22318
Midway	TX	230
Midway North	TX	4752
Midway South	TX	2239
Miguel Barrera	TX	0
Mikes	TX	0
Mila Doce	TX	6222
Milam	TX	1480
Milano	TX	421
Mildred	TX	371
Miles	TX	864
Milford	TX	739
Miller's Cove	TX	0
Millers Cove	TX	149
Millican	TX	243
Millsap	TX	427
Mineola	TX	4625
Mineral Wells	TX	14754
Mingus	TX	231
Mirando	TX	0
Mirando City	TX	375
Mission	TX	83298
Mission Bend	TX	36501
Missouri	TX	0
Missouri City	TX	74139
Mobeetie	TX	101
Mobile	TX	0
Mobile City	TX	192
Monahans	TX	7690
Mont Belvieu	TX	5193
Montague	TX	304
Monte Alto	TX	1924
Montgomery	TX	806
Moody	TX	1380
Moore	TX	475
Moore Station	TX	199
Moraida	TX	212
Morales-Sanchez	TX	84
Moran	TX	268
Morgan	TX	482
Morgan Farm	TX	0
Morgan Farm Colonia	TX	463
Morgan's Point	TX	0
Morgan's Point Resort	TX	0
Morgans Point	TX	339
Morgans Point Resort	TX	4170
Morning Glory	TX	651
Morse	TX	147
Morton	TX	1892
Mosheim	TX	0
Moulton	TX	907
Mound	TX	0
Mount Calm	TX	315
Mount Enterprise	TX	444
Mount Pleasant	TX	16051
Mount Vernon	TX	2753
Mountain	TX	0
Mountain City	TX	659
Muenster	TX	1608
Muleshoe	TX	5185
Mullin	TX	175
Munday	TX	1339
Muniz	TX	1370
Murchison	TX	594
Murillo	TX	0
Murillo Colonia	TX	7344
Murphy	TX	20610
Mustang	TX	21
Mustang Ridge	TX	969
Myra	TX	0
Myrtle Springs	TX	828
Nacogdoches	TX	33894
Nada	TX	0
Naples	TX	1339
Narciso Pena	TX	0
Nash	TX	3141
Nassau Bay	TX	4100
Natalia	TX	1490
Navarro	TX	209
Navasota	TX	7476
Nazareth	TX	294
Neches	TX	0
Nederland	TX	17196
Needville	TX	3063
Nesbitt	TX	313
Netos	TX	31
Nevada	TX	1008
New Berlin	TX	535
New Boston	TX	4688
New Braunfels	TX	70543
New Caney	TX	20000
New Chapel Hill	TX	616
New Deal	TX	804
New Fairview	TX	1334
New Falcon	TX	191
New Home	TX	341
New Hope	TX	639
New Hope (historical)	TX	603
New London	TX	997
New Summerfield	TX	1111
New Territory	TX	15186
New Ulm	TX	0
New Waverly	TX	1040
Newark	TX	1061
Newcastle	TX	570
Newton	TX	2403
Neylandville	TX	100
Niederwald	TX	565
Nimrod	TX	141
Nina	TX	0
Nixon	TX	2465
Nocona	TX	2939
Nocona Hills	TX	675
Nolanville	TX	4774
Nome	TX	562
Noonday	TX	777
Nordheim	TX	318
Normandy	TX	0
Normangee	TX	693
Normanna	TX	113
North Alamo	TX	3235
North Cleveland	TX	247
North Escobares	TX	118
North Pearsall	TX	614
North Richland Hills	TX	69204
North San Pedro	TX	895
Northcrest	TX	1785
Northlake	TX	2237
Novice	TX	131
Nurillo	TX	5547
O'Brien	TX	103
O'Donnell	TX	807
Oak Cliff Place	TX	1800
Oak Grove	TX	667
Oak Island	TX	363
Oak Leaf	TX	1373
Oak Point	TX	3349
Oak Ridge	TX	575
Oak Ridge North	TX	3161
Oak Trail Shores	TX	2755
Oak Valley	TX	377
Oakhurst	TX	233
Oakwood	TX	516
Odem	TX	2482
Odessa	TX	114428
Oglesby	TX	468
Oilton	TX	353
Oklaunion	TX	0
Old Escobares	TX	97
Old River-Winfree	TX	1288
Olivarez	TX	3827
Olivia Lopez de Gutierrez	TX	0
Olmito	TX	1210
Olmito and Olmito	TX	0
Olmos Park	TX	2390
Olney	TX	3179
Olton	TX	2137
Omaha	TX	993
Onalaska	TX	1764
Onion Creek	TX	2116
Opdyke West	TX	176
Orange	TX	19347
Orange Grove	TX	1334
Orason	TX	0
Orason Acres Colonia	TX	129
Orchard	TX	367
Ore	TX	0
Ore City	TX	1189
Overton	TX	2536
Ovilla	TX	3855
Owl Ranch	TX	225
Oyster Creek	TX	1132
Ozona	TX	3225
Pablo Pena	TX	0
Paducah	TX	1122
Paige	TX	0
Paint Rock	TX	266
Paisano Park	TX	0
Paisano Park Colonia	TX	130
Palacios	TX	4634
Palestine	TX	18288
Palisades	TX	335
Palm Valley	TX	1294
Palmer	TX	2055
Palmhurst	TX	2687
Palmview	TX	5715
Palmview South	TX	5575
Palo Blanco	TX	0
Palo Pinto	TX	333
Paloma Creek	TX	2501
Paloma Creek South	TX	2753
Pampa	TX	18177
Panhandle	TX	2341
Panorama	TX	0
Panorama Village	TX	2293
Pantego	TX	2531
Paradise	TX	468
Paris	TX	24782
Parker	TX	4352
Pasadena	TX	153784
Pattison	TX	532
Patton	TX	0
Patton Village	TX	1620
Pawnee	TX	166
Payne Springs	TX	768
Pearland	TX	108821
Pearsall	TX	9980
Peaster	TX	0
Pecan	TX	0
Pecan Acres	TX	4099
Pecan Gap	TX	197
Pecan Grove	TX	15963
Pecan Hill	TX	647
Pecan Plantation	TX	5294
Pecos	TX	9517
Pelican Bay	TX	1635
Pena	TX	0
Pendleton	TX	0
Penelope	TX	197
Penitas	TX	4715
Perezville	TX	5376
Pernitas Point	TX	258
Perrin	TX	398
Perryton	TX	9252
Petersburg	TX	1131
Petrolia	TX	660
Petronila	TX	114
Pettus	TX	558
Petty	TX	0
Pflugerville	TX	57122
Pharr	TX	76538
Pilot Point	TX	4093
Pine Forest	TX	623
Pine Harbor	TX	0
Pine Island	TX	1076
Pinebrook	TX	0
Pinehurst	TX	4624
Pineland	TX	813
Pinewood Estates	TX	1678
Piney Point	TX	0
Piney Point Village	TX	3376
Pittsburg	TX	4602
Placedo	TX	692
Plains	TX	1616
Plainview	TX	20919
Plano	TX	283558
Plantersville	TX	0
Pleak	TX	1366
Pleasant Hill	TX	522
Pleasant Valley	TX	380
Pleasanton	TX	9829
Plum	TX	0
Plum Grove	TX	1027
Poetry	TX	0
Point	TX	834
Point Blank	TX	0
Point Comfort	TX	723
Point Venture	TX	902
Pointblank	TX	575
Ponder	TX	1530
Port Aransas	TX	3955
Port Arthur	TX	55340
Port Isabel	TX	5016
Port Lavaca	TX	12416
Port Mansfield	TX	226
Port Neches	TX	12786
Port O'Connor	TX	1253
Porter Heights	TX	1653
Portland	TX	16116
Post	TX	5349
Post Oak Bend	TX	0
Post Oak Bend City	TX	687
Poteet	TX	3419
Poth	TX	2167
Potosi	TX	2991
Pottsboro	TX	2250
Powderly	TX	1178
Powell	TX	138
Poynor	TX	305
Prado Verde	TX	246
Praesel	TX	0
Prairie View	TX	6369
Premont	TX	2659
Presidio	TX	3904
Preston	TX	2096
Priddy	TX	0
Primera	TX	4626
Princeton	TX	8939
Proctor	TX	0
Progreso	TX	5922
Progreso Lakes	TX	251
Prosper	TX	15967
Providence	TX	0
Providence Village	TX	4786
Pueblo East	TX	0
Pueblo Nuevo	TX	521
Pueblo Nuevo Colonia	TX	521
Putnam	TX	93
Pyote	TX	124
Quail	TX	19
Quail Creek	TX	1628
Quanah	TX	2438
Queen	TX	0
Queen City	TX	1468
Quemado	TX	230
Quesada	TX	0
Quinlan	TX	1439
Quintana	TX	65
Quitaque	TX	378
Quitman	TX	1827
Radar Base	TX	762
Rafael Pena	TX	0
Ralls	TX	1898
Ramireno	TX	35
Ramirez-Perez	TX	78
Ramos	TX	0
Ranchette Estates	TX	152
Ranchitos del Norte	TX	0
Ranchitos East	TX	0
Ranchitos Las Lomas	TX	266
Rancho Alegre	TX	1704
Rancho Banquete	TX	424
Rancho Chico	TX	396
Rancho Viejo	TX	2491
Ranchos Penitas West	TX	573
Ranchos Penitas West Colonia	TX	573
Randolph AFB	TX	0
Ranger	TX	2464
Rangerville	TX	289
Rankin	TX	844
Ransom Canyon	TX	1131
Ratamosa	TX	254
Ravenna	TX	206
Raymondville	TX	11139
Realitos	TX	184
Red Lick	TX	1006
Red Oak	TX	12022
Red Rock	TX	0
Redfield	TX	441
Redford	TX	90
Redland	TX	1047
Redwater	TX	1071
Redwood	TX	4338
Refugio	TX	2855
Regino Ramirez	TX	0
Reid Hope King	TX	786
Reid Hope King Colonia	TX	786
Reklaw	TX	381
Relampago	TX	132
Rendon	TX	12552
Reno	TX	3281
Retreat	TX	392
Rhome	TX	1630
Ricardo	TX	1048
Rice	TX	952
Rice Tracts	TX	0
Richards	TX	0
Richardson	TX	110815
Richland	TX	266
Richland Hills	TX	8098
Richland Springs	TX	329
Richmond	TX	12138
Richwood	TX	3830
Riesel	TX	1019
Ringgold	TX	0
Rio Bravo	TX	4818
Rio Grande	TX	0
Rio Grande City	TX	14404
Rio Hondo	TX	2445
Rio Vista	TX	933
Rising Star	TX	827
River Oaks	TX	7724
Rivereno	TX	0
Riverside	TX	510
Riviera	TX	689
Road Runner	TX	0
Roanoke	TX	7400
Roaring Springs	TX	222
Robert Lee	TX	1020
Robinson	TX	11484
Robstown	TX	11576
Roby	TX	621
Rochelle	TX	0
Rochester	TX	315
Rock Island	TX	0
Rockdale	TX	5609
Rockport	TX	10490
Rocksprings	TX	1116
Rockwall	TX	42566
Rockwell Place	TX	0
Rocky Mound	TX	69
Rogers	TX	1211
Rolling Meadows	TX	309
Rollingwood	TX	1543
Roma	TX	10223
Roma Creek	TX	350
Roma-Los Saenz	TX	9765
Roman Forest	TX	1847
Ropesville	TX	439
Rosanky	TX	0
Roscoe	TX	1325
Rose	TX	0
Rose City	TX	518
Rose Hill Acres	TX	445
Rosebud	TX	1373
Rosenberg	TX	35510
Rosharon	TX	1152
Rosita	TX	0
Rosita North	TX	3818
Rosita South	TX	2704
Ross	TX	286
Rosser	TX	357
Rotan	TX	1442
Round Mountain	TX	181
Round Rock	TX	115997
Round Top	TX	93
Rowena	TX	0
Rowlett	TX	60236
Roxton	TX	642
Royse	TX	0
Royse City	TX	11465
Rule	TX	619
Runaway Bay	TX	1408
Runge	TX	1062
Rusk	TX	5618
Sabinal	TX	1717
Sachse	TX	24554
Sadler	TX	356
Saginaw	TX	22079
Saint Hedwig	TX	2094
Saint Jo	TX	1043
Saint Paul	TX	1066
Salado	TX	2140
Salida del Sol Estates	TX	0
SalineÃ±o	TX	0
SalineÃ±o North	TX	0
Salineño	TX	201
Sam Rayburn	TX	1181
Sammy Martinez	TX	0
Samnorwood	TX	51
Samuel Man Barfield III	TX	3
San Angelo	TX	99893
San Antonio	TX	1526656
San Augustine	TX	2009
San Benito	TX	24496
San Carlos	TX	3130
San Carlos I	TX	0
San Carlos II	TX	261
San Carlos Number 1 Colonia	TX	316
San Diego	TX	4368
San Elizario	TX	8999
San Felipe	TX	793
San Fernando	TX	0
San Isidro	TX	240
San Juan	TX	36556
San Juan Colonia	TX	129
San Leanna	TX	536
San Leon	TX	4970
San Marcos	TX	60684
San Patricio	TX	395
San Pedro	TX	733
San Perlita	TX	566
San Saba	TX	3030
San Ygnacio	TX	667
Sanctuary	TX	347
Sand Springs	TX	835
Sanderson	TX	837
Sandia	TX	379
Sandoval	TX	32
Sandy Hollow-Escondidas	TX	296
Sandy Oaks	TX	0
Sandy Point	TX	216
Sanford	TX	161
Sanger	TX	7747
Sansom Park	TX	4858
Santa Anna	TX	1034
Santa Clara	TX	725
Santa Cruz	TX	54
Santa Fe	TX	13037
Santa Maria	TX	733
Santa Monica	TX	83
Santa Rita Ranch	TX	0
Santa Rosa	TX	2876
Santa Rosa Colonia	TX	241
Santel	TX	0
Santo	TX	0
Sargent	TX	0
Sarita	TX	238
Savannah	TX	3318
Savoy	TX	825
Scenic Oaks	TX	4957
Schertz	TX	43091
Schulenburg	TX	2925
Scissors	TX	3186
Scotland	TX	478
Scottsville	TX	359
Scurry	TX	736
Seabrook	TX	13716
Seadrift	TX	1474
Seagoville	TX	15894
Seagraves	TX	2762
Sealy	TX	6403
Sebastian	TX	1917
Seco Mines	TX	560
Seguin	TX	27864
Seis Lagos	TX	0
Selma	TX	9108
Seminole	TX	7448
Serenada	TX	1641
Seth Ward	TX	2025
Seven Oaks	TX	113
Seven Points	TX	1447
Seymour	TX	2652
Shady Hollow	TX	5004
Shady Shores	TX	2866
Shadybrook	TX	0
Shallowater	TX	2555
Shamrock	TX	1989
Shavano Park	TX	3527
Sheffield	TX	0
Shelbyville	TX	0
Sheldon	TX	1990
Shenandoah	TX	2770
Shepherd	TX	2418
Sheridan	TX	0
Sherman	TX	40667
Sherwood Shores	TX	1190
Shiner	TX	2139
Shiro	TX	0
Shoreacres	TX	1603
Sienna	TX	0
Sienna Plantation	TX	13721
Sierra Blanca	TX	553
Siesta Acres	TX	1885
Siesta Shores	TX	1382
Silsbee	TX	6688
Silverton	TX	672
Simonton	TX	863
Sinton	TX	5736
Skellytown	TX	473
Skidmore	TX	925
Slaton	TX	6072
Smiley	TX	567
Smithville	TX	4101
Smyer	TX	480
Snook	TX	512
Snyder	TX	11768
Socorro	TX	33222
Socorro Mission Number 1 Colonia	TX	28637
Solis	TX	512
Somerset	TX	1783
Somerville	TX	1383
Sonora	TX	2863
Sonterra	TX	0
Sour Lake	TX	1773
South Alamo	TX	3361
South Fork Estates	TX	70
South Frydek	TX	0
South Houston	TX	17544
South La Paloma	TX	0
South Mountain	TX	371
South Padre Island	TX	2884
South Point	TX	1376
South Toledo Bend	TX	524
Southlake	TX	29941
Southmayd	TX	1015
Southside Place	TX	1835
Southwest Sandhill	TX	0
Spade	TX	73
Sparks	TX	4529
Spearman	TX	3375
Splendora	TX	1684
Spofford	TX	94
Spring	TX	54298
Spring Branch	TX	0
Spring Gardens	TX	563
Spring Valley	TX	3611
Springlake	TX	104
Springtown	TX	2811
Spur	TX	1205
St. Hedwig	TX	0
St. Jo	TX	0
St. Paul	TX	0
Stafford	TX	18459
Stagecoach	TX	583
Stamford	TX	2973
Stanton	TX	2936
Staples	TX	278
Star Harbor	TX	455
Starbase	TX	500
Steiner Ranch	TX	0
Stephenville	TX	20120
Sterling	TX	0
Sterling City	TX	1049
Stinnett	TX	1856
Stockdale	TX	1564
Stockton Bend	TX	0
Stonewall	TX	505
Stowell	TX	1756
Stratford	TX	2073
Strawn	TX	643
Streetman	TX	246
Study Butte	TX	233
Sudan	TX	921
Sugar Land	TX	88156
Sullivan	TX	0
Sullivan City	TX	4189
Sulphur Springs	TX	16098
Summerfield	TX	0
Sun Valley	TX	68
Sundown	TX	1422
Sunnyvale	TX	6044
Sunray	TX	1931
Sunrise Beach	TX	0
Sunrise Beach Village	TX	731
Sunrise Shores	TX	0
Sunset	TX	497
Sunset Acres	TX	0
Sunset Acres Colonia	TX	23
Sunset Colonia	TX	47
Sunset Valley	TX	749
Surfside Beach	TX	544
Sweeny	TX	3771
Sweetwater	TX	10809
Sylvester	TX	0
Taft	TX	3091
Taft Southwest	TX	0
Taft Southwest (historical)	TX	1460
Tahoka	TX	2570
Talco	TX	513
Talty	TX	1927
Tanquecitos South Acres	TX	0
Tanquecitos South Acres II	TX	50
Tatum	TX	1379
Taylor	TX	16702
Taylor Lake	TX	0
Taylor Lake Village	TX	3656
Taylor Landing	TX	233
Teague	TX	3572
Tehuacana	TX	282
Temple	TX	72277
Tenaha	TX	1152
Terlingua	TX	58
Terrell	TX	16981
Terrell Hills	TX	5287
Texarkana	TX	37280
Texas	TX	0
Texas City	TX	47618
Texhoma	TX	340
Texline	TX	525
The Colony	TX	41779
The Hills	TX	2573
The Homesteads	TX	0
The Trails of Frisco	TX	51059
The Woodlands	TX	93847
Thompsons	TX	246
Thompsonville	TX	46
Thorndale	TX	1316
Thornton	TX	523
Thorntonville	TX	518
Thrall	TX	920
Three Rivers	TX	1971
Throckmorton	TX	797
Thunderbird Bay	TX	0
Tierra Bonita	TX	141
Tierra Bonita Colonia	TX	176
Tierra Dorada	TX	0
Tierra Grande	TX	403
Tierra Verde	TX	0
Tiki Island	TX	1026
Tilden	TX	261
Timbercreek Canyon	TX	445
Timberwood Park	TX	13447
Timpson	TX	1149
Tioga	TX	862
Tira	TX	302
Tivoli	TX	479
Toco	TX	74
Todd Mission	TX	110
Tolar	TX	828
Tom Bean	TX	1055
Tomball	TX	11540
Tool	TX	2268
Tornillo	TX	1568
Tow	TX	0
Town of Pecos	TX	0
Toyah	TX	98
Tradewinds	TX	180
Travis Ranch	TX	2556
Trent	TX	343
Trenton	TX	628
Trinidad	TX	878
Trinity	TX	2752
Trophy Club	TX	11759
Troup	TX	1966
Troy	TX	1843
Tuleta	TX	288
Tulia	TX	4760
Tulsita	TX	14
Tunis	TX	0
Turkey	TX	396
Tuscola	TX	744
Tye	TX	1260
Tyler	TX	103700
Tynan	TX	278
Uhland	TX	1052
Umbarger	TX	0
Uncertain	TX	94
Union Grove	TX	372
Union Valley	TX	337
Universal	TX	0
Universal City	TX	19986
University of Texas	TX	53082
University Park	TX	24759
Utopia	TX	227
Uvalde	TX	16476
Uvalde Estates	TX	2171
Val Verde Park	TX	2384
Valentine	TX	123
Valera	TX	0
Valle Hermoso	TX	0
Valle Verde	TX	0
Valle Vista	TX	0
Valley Mills	TX	1177
Valley View	TX	768
Van	TX	2685
Van Alstyne	TX	3344
Van Horn	TX	1928
Van Vleck	TX	1844
Vanderbilt	TX	395
Vega	TX	900
Venus	TX	3297
Vernon	TX	10573
Victoria	TX	67574
Victoria Vera	TX	0
Vidor	TX	10945
Villa del Sol	TX	175
Villa Pancho	TX	788
Villa Verde	TX	874
Villarreal	TX	131
Vinton	TX	1973
Volente	TX	563
Von Ormy	TX	1175
Waco	TX	132356
Wadsworth	TX	0
Waelder	TX	997
Waka	TX	0
Wake	TX	0
Wake Village	TX	5471
Waller	TX	2522
Wallis	TX	1294
Walnut Springs	TX	811
Warren	TX	757
Warren City	TX	299
Washburn	TX	0
Waskom	TX	2177
Watauga	TX	24525
Waxahachie	TX	33384
Weatherford	TX	28742
Webberville	TX	412
Webster	TX	11116
Weimar	TX	2161
Weinert	TX	168
Weir	TX	450
Welch	TX	222
Wellington	TX	2174
Wellman	TX	203
Wells	TX	796
Wells Branch	TX	12120
Weslaco	TX	39474
West	TX	2883
West Alto Bonito	TX	0
West Alto Bonito Colonia	TX	696
West Columbia	TX	3935
West Lake Hills	TX	3317
West Livingston	TX	8071
West Odessa	TX	22707
West Orange	TX	3458
West Pearsall	TX	383
West Sharyland	TX	2309
West Tawakoni	TX	1576
West University Place	TX	15741
Westbrook	TX	254
Westdale	TX	372
Western Lake	TX	1525
Westlake	TX	1264
Westminster	TX	861
Weston	TX	334
Weston Lakes	TX	2589
Westover Hills	TX	721
Westway	TX	4188
Westwood Shores	TX	0
Westworth	TX	2124
Wharton	TX	8726
Wheeler	TX	1656
White Deer	TX	966
White Oak	TX	6345
White Settlement	TX	17077
Whiteface	TX	422
Whitehouse	TX	8189
Whitesboro	TX	3909
Whitewright	TX	1633
Whitharral	TX	0
Whitney	TX	2101
Wichita Falls	TX	104710
Wickett	TX	539
Wild Peach	TX	0
Wild Peach Village	TX	2452
Wildorado	TX	0
Wildwood	TX	1235
Willamar	TX	16
Willis	TX	6313
Willow Grove	TX	0
Willow Park	TX	4922
Wills Point	TX	3547
Wilmer	TX	3928
Wilson	TX	475
Wimberley	TX	2670
Windcrest	TX	5794
Windemere	TX	1037
Windom	TX	197
Windthorst	TX	390
Winfield	TX	524
Wingate	TX	0
Wink	TX	1060
Winnie	TX	3254
Winnsboro	TX	3340
Winona	TX	598
Winters	TX	2563
Wixon Valley	TX	261
Wolfe	TX	0
Wolfe City	TX	1416
Wolfforth	TX	4249
Woodbranch	TX	1377
Woodcreek	TX	1528
Woodloch	TX	214
Woodsboro	TX	1483
Woodson	TX	254
Woodville	TX	2478
Woodway	TX	8777
Wortham	TX	1028
Wyldwood	TX	2505
Wylie	TX	46708
Yancey	TX	0
Yantis	TX	394
Yoakum	TX	6016
Yorktown	TX	2145
Yznaga	TX	91
Zapata	TX	5089
Zapata Ranch	TX	108
Zapata Ranch Colonia	TX	97
Zarate	TX	0
Zavalla	TX	715
Zephyr	TX	0
Zuehl	TX	376
Alpine	UT	10235
Alta	UT	390
Altamont	UT	263
Alton	UT	116
Amalga	UT	514
American Fork	UT	28326
Aneth	UT	501
Annabella	UT	800
Antimony	UT	120
Apple Valley	UT	718
Aurora	UT	1029
Avon	UT	367
Ballard	UT	1106
Bear River	UT	0
Bear River City	UT	852
Beaver	UT	3007
Benjamin	UT	1145
Benson	UT	1485
Beryl Junction	UT	197
Bicknell	UT	327
Big Water	UT	467
Bingham Canyon	UT	726
Blanding	UT	3785
Bluebell	UT	293
Bluff	UT	258
Bluffdale	UT	10931
Bonanza	UT	1
Boulder	UT	0
Boulder Town	UT	226
Bountiful	UT	43784
Brian Head	UT	87
Brigham	UT	0
Brigham City	UT	18752
Brighton	UT	0
Bryce Canyon	UT	0
Bryce Canyon City	UT	223
Cache	UT	38
Cannonville	UT	169
Canyon Rim	UT	10062
Carbonville	UT	1567
Castle Dale	UT	1550
Castle Valley	UT	342
Cedar	UT	0
Cedar City	UT	30184
Cedar Fort	UT	383
Cedar Highlands	UT	0
Cedar Hills	UT	10265
Cedar Valley	UT	871
Centerfield	UT	1387
Centerville	UT	16877
Central	UT	613
Central Valley	UT	554
Charleston	UT	467
Circleville	UT	523
Clarkston	UT	694
Clawson	UT	193
Clear Creek	UT	4
Clearfield	UT	30653
Cleveland	UT	448
Clinton	UT	21399
Coalville	UT	1431
Copperton	UT	826
Copperton metro	UT	0
Corinne	UT	694
Cornish	UT	312
Cottonwood Heights	UT	34343
Cove	UT	460
Dammeron Valley	UT	803
Daniel	UT	1058
Delta	UT	3482
Deseret	UT	353
Deweyville	UT	333
Draper	UT	46774
Duchesne	UT	1872
Dugway	UT	795
Dutch John	UT	145
Eagle Mountain	UT	27332
East Basin	UT	0
East Carbon	UT	0
East Carbon City	UT	1270
East Millcreek	UT	20816
Echo	UT	56
Eden	UT	600
Elberta	UT	256
Elk Ridge	UT	3183
Elmo	UT	413
Elsinore	UT	857
Elwood	UT	1070
Emery	UT	272
Emigration Canyon metro	UT	0
Enoch	UT	6265
Enterprise	UT	1799
Ephraim	UT	6857
Erda	UT	4642
Escalante	UT	790
Eureka	UT	666
Fairfield	UT	130
Fairview	UT	1261
Farmington	UT	22566
Farr West	UT	6616
Fayette	UT	245
Ferron	UT	1562
Fielding	UT	452
Fillmore	UT	2489
Flaming Gorge	UT	0
Fort Duchesne	UT	714
Fountain Green	UT	1083
Francis	UT	1258
Fremont	UT	145
Fruit Heights	UT	6072
Garden	UT	181
Garden City	UT	580
Garland	UT	2448
Genola	UT	1419
Glendale	UT	365
Glenwood	UT	469
Goshen	UT	944
Granite	UT	1932
Grantsville	UT	10027
Green River	UT	961
Gunnison	UT	3238
Halchita	UT	266
Halls Crossing	UT	6
Hanksville	UT	212
Harrisville	UT	6221
Hatch	UT	141
Heber	UT	0
Heber City	UT	9198
Helper	UT	2112
Henefer	UT	862
Henrieville	UT	220
Herriman	UT	30835
Hiawatha	UT	45
Hideout	UT	718
Highland	UT	17989
Hildale	UT	2927
Hill Air Force Base	UT	3462
Hinckley	UT	695
Hobble Creek	UT	0
Holden	UT	373
Holladay	UT	30864
Honeyville	UT	1454
Hooper	UT	8214
Howell	UT	248
Hoytsville	UT	607
Huntington	UT	2004
Huntsville	UT	621
Hurricane	UT	15501
Hyde Park	UT	4375
Hyrum	UT	7962
Independence	UT	169
Interlaken	UT	0
Ivins	UT	7876
Jensen	UT	412
Joseph	UT	343
Junction	UT	183
Kamas	UT	2053
Kanab	UT	4394
Kanarraville	UT	369
Kanosh	UT	468
Kaysville	UT	30472
Kearns	UT	35731
Kearns metro	UT	0
Kenilworth	UT	180
Kingston	UT	165
Koosharem	UT	327
La Sal	UT	395
La Verkin	UT	0
Lake Point	UT	0
Lake Powell	UT	134
Lake Shore	UT	817
Laketown	UT	260
Lapoint	UT	0
LaVerkin	UT	4060
Layton	UT	74143
Leamington	UT	231
Leeds	UT	842
Lehi	UT	58486
Levan	UT	871
Lewiston	UT	1768
Liberty	UT	1257
Lindon	UT	10810
Little Cottonwood Creek Valley	UT	8285
Loa	UT	588
Logan	UT	50371
Lyman	UT	249
Lynndyl	UT	111
Maeser	UT	3601
Magna	UT	26505
Magna metro	UT	0
Manila	UT	331
Manti	UT	3353
Mantua	UT	732
Mapleton	UT	9232
Marion	UT	685
Marriott-Slaterville	UT	1744
Marysvale	UT	407
Mayfield	UT	521
Meadow	UT	313
Mendon	UT	1348
Mexican Hat	UT	31
Midvale	UT	32613
Midway	UT	4646
Milford	UT	1331
Millcreek	UT	62139
Millville	UT	1970
Minersville	UT	869
Moab	UT	5235
Modena	UT	0
Mona	UT	1598
Monroe	UT	2293
Montezuma Creek	UT	335
Monticello	UT	2069
Morgan	UT	4049
Moroni	UT	1451
Mount Nebo	UT	302
Mount Olympus	UT	6748
Mount Pleasant	UT	3299
Mountain Green	UT	2309
Murray	UT	49250
Myton	UT	639
Naples	UT	2212
Navajo Mountain	UT	354
Neola	UT	461
Nephi	UT	5560
New Harmony	UT	211
Newcastle	UT	247
Newton	UT	782
Nibley	UT	6451
North Logan	UT	10181
North Ogden	UT	18446
North Salt Lake	UT	19796
Oak	UT	0
Oak City	UT	623
Oakley	UT	1591
Oasis	UT	75
Ogden	UT	85444
Oljato-Monument Valley	UT	674
Ophir	UT	38
Oquirrh	UT	11668
Orangeville	UT	1394
Orderville	UT	559
Orem	UT	94457
Palmyra	UT	491
Panguitch	UT	1481
Paradise	UT	943
Paragonah	UT	509
Park	UT	0
Park City	UT	8128
Parowan	UT	2926
Payson	UT	19548
Peoa	UT	253
Perry	UT	4702
Peter	UT	324
Pine Valley	UT	186
Plain	UT	0
Plain City	UT	6299
Pleasant Grove	UT	38052
Pleasant View	UT	9273
Plymouth	UT	413
Portage	UT	255
Price	UT	8378
Providence	UT	7124
Provo	UT	115162
Randlett	UT	220
Randolph	UT	462
Redmond	UT	737
Richfield	UT	7592
Richmond	UT	2580
River Heights	UT	1941
Riverdale	UT	8666
Riverside	UT	760
Riverton	UT	41900
Rockville	UT	262
Rocky Ridge	UT	773
Roosevelt	UT	6980
Roy	UT	37964
Rush Valley	UT	475
Saint George	UT	72897
Salem	UT	7475
Salina	UT	2521
Salt Lake	UT	0
Salt Lake City	UT	215548
Samak	UT	287
Sandy	UT	87461
Sandy Hills	UT	89575
Santa Clara	UT	6841
Santaquin	UT	10572
Saratoga Springs	UT	25407
Scipio	UT	322
Scofield	UT	23
Sigurd	UT	432
Silver Summit	UT	3632
Smithfield	UT	10782
Snowbird	UT	383
Snowville	UT	171
Snyderville	UT	5612
South Jordan	UT	66648
South Jordan Heights	UT	37141
South Ogden	UT	16955
South Salt Lake	UT	24788
South Weber	UT	6971
South Willard	UT	1571
Spanish Fork	UT	37935
Spanish Valley	UT	491
Spring	UT	0
Spring City	UT	1002
Spring Glen	UT	1126
Spring Lake	UT	458
Springdale	UT	556
Springville	UT	32286
St. George	UT	0
Stansbury park	UT	5145
Sterling	UT	296
Stockton	UT	642
Summit	UT	160
Summit Park	UT	7775
Sundance	UT	0
Sunnyside	UT	377
Sunset	UT	5183
Sutherland	UT	165
Syracuse	UT	27395
Tabiona	UT	174
Taylorsville	UT	60514
Teasdale	UT	191
Thatcher	UT	789
Thompson Springs	UT	39
Timber Lakes	UT	607
Tooele	UT	33157
Toquerville	UT	1493
Torrey	UT	184
Tremonton	UT	8227
Trenton	UT	507
Tropic	UT	512
Tselakai Dezza	UT	109
Uintah	UT	1328
Vernal	UT	11200
Vernon	UT	275
Veyo	UT	483
Vineyard	UT	3195
Virgin	UT	604
Wales	UT	348
Wallsburg	UT	325
Wanship	UT	400
Washington	UT	24299
Washington Terrace	UT	9157
Wellington	UT	1621
Wellsville	UT	3650
Wendover	UT	1400
West Bountiful	UT	5511
West Haven	UT	11921
West Jordan	UT	111946
West Mountain	UT	1186
West Point	UT	10345
West Valley	UT	0
West Valley City	UT	136208
West Wood	UT	844
White City	UT	5407
White City metro	UT	0
White Mesa	UT	242
Whiterocks	UT	289
Willard	UT	1787
Wolf Creek	UT	1336
Woodland	UT	343
Woodland Hills	UT	1482
Woodruff	UT	187
Woods Cross	UT	11284
Abbs Valley	VA	0
Abingdon	VA	8119
Accomac	VA	496
Adwolf	VA	1530
Afton	VA	0
Alberta	VA	285
Aldie	VA	70
Alexandria	VA	159467
Allison Gap	VA	0
Allisonia	VA	117
Alonzaville	VA	0
Altavista	VA	3474
Amelia Court House	VA	1099
Amherst	VA	2210
Amonate	VA	0
Annandale	VA	41008
Appalachia	VA	1671
Apple Mountain Lake	VA	1396
Appomattox	VA	1759
Aquia Harbour	VA	6727
Arcola	VA	233
Arlington	VA	207627
Arrington	VA	708
Ashburn	VA	43511
Ashland	VA	7503
Atkins	VA	1143
Atlantic	VA	862
Augusta Springs	VA	257
Austinville	VA	0
Bailey's Crossroads	VA	0
Baileys Crossroads	VA	23643
Barboursville	VA	0
Baskerville	VA	128
Bassett	VA	1100
Bastian	VA	0
Basye	VA	1253
Bayside	VA	120
Baywood	VA	0
Bealeton	VA	4435
Bedford	VA	6561
Belle Haven	VA	6518
Bellwood	VA	6352
Belmont	VA	5966
Belmont Estates	VA	1263
Belspring	VA	256
Belview	VA	0
Benns Church	VA	872
Bensley	VA	5819
Berryville	VA	4300
Bethel Manor	VA	0
Big Island	VA	303
Big Rock	VA	0
Big Stone Gap	VA	5614
Big Stone Gap East	VA	0
Blacksburg	VA	44215
Blackstone	VA	3491
Blairs	VA	916
Bland	VA	409
Bloxom	VA	385
Blue Ridge	VA	3084
Blue Ridge Shores	VA	813
Bluefield	VA	5279
Bobtown	VA	211
Boissevain	VA	0
Bon Air	VA	16366
Boones Mill	VA	233
Boston	VA	504
Boswell's Corner	VA	1375
Bowling Green	VA	1160
Bowmans Crossing	VA	0
Boyce	VA	615
Boydton	VA	416
Boykins	VA	543
Bracey	VA	1554
Braddock	VA	0
Brambleton	VA	9845
Branchville	VA	117
Brandermill	VA	13173
Brandy Station	VA	0
Breaks	VA	0
Bridgewater	VA	5889
Brightwood	VA	1001
Bristol	VA	17141
Bristow	VA	8910
Broadlands	VA	12313
Broadway	VA	3807
Brodnax	VA	281
Brookneal	VA	1119
Brucetown	VA	0
Buchanan	VA	1178
Buckhall	VA	16293
Buckingham Courthouse	VA	0
Buena Vista	VA	6618
Bull Run	VA	14983
Bull Run Mountain Estates	VA	1251
Burke	VA	41055
Burke Centre	VA	0
Burkeville	VA	412
Callaghan	VA	348
Calverton	VA	239
Camp Barrett	VA	0
Camptown	VA	0
Cana	VA	1254
Cape Charles	VA	1017
Capron	VA	157
Captains Cove	VA	1042
Carrollton	VA	4574
Carrsville	VA	359
Cascades	VA	0
Castlewood	VA	2045
Catlett	VA	296
Cats Bridge	VA	229
Cave Spring	VA	24922
Cedar Bluff	VA	1076
Central Garage	VA	1318
Centreville	VA	71135
Chamberlayne	VA	5456
Chantilly	VA	23039
Charles	VA	0
Charles City	VA	133
Charlotte Court House	VA	530
Charlottesville	VA	46597
Chase	VA	0
Chase City	VA	2296
Chase Crossing	VA	377
Chatham	VA	1481
Chatmoss	VA	1698
Cheriton	VA	475
Cherry Hill	VA	16000
Chesapeake	VA	235429
Chester	VA	20987
Chester Gap	VA	839
Chesterfield Court House	VA	3808
Chilhowie	VA	1741
Chincoteague	VA	2914
Christiansburg	VA	21943
Churchville	VA	194
Claremont	VA	354
Clarksville	VA	1204
Clary	VA	0
Claypool Hill	VA	1776
Cleveland	VA	187
Clifton	VA	295
Clifton Forge	VA	3739
Cliftondale Park	VA	0
Clinchco	VA	317
Clinchport	VA	67
Clintwood	VA	1325
Clover	VA	438
Cloverdale	VA	3119
Cluster Springs	VA	811
Coeburn	VA	1999
Collinsville	VA	7335
Colonial Beach	VA	3580
Colonial Heights	VA	17820
Columbia	VA	80
Columbia Furnace	VA	0
Concord	VA	1458
Conicville	VA	0
Countryside	VA	10072
County Center	VA	0
Courtland	VA	1246
Covesville	VA	296
Covington	VA	5658
Craigsville	VA	930
Crewe	VA	2241
Crimora	VA	2209
Crosspointe	VA	0
Crozet	VA	5565
Culpeper	VA	17557
Cumberland	VA	393
Dahlgren	VA	2653
Dahlgren Center	VA	0
Dale	VA	0
Dale City	VA	65969
Daleville	VA	2557
Damascus	VA	800
Dante	VA	649
Danville	VA	42082
Dayton	VA	1588
Deep Creek	VA	115
Deerfield	VA	132
Deltaville	VA	1119
Dendron	VA	256
Difficult Run	VA	0
Dillwyn	VA	444
Dinwiddie	VA	0
Disputanta	VA	0
Dooms	VA	1327
Doran	VA	0
Drakes Branch	VA	515
Dranesville	VA	11921
Draper	VA	320
Dryden	VA	1208
Dublin	VA	2686
Duffield	VA	86
Dulles Town Center	VA	4601
Dumbarton	VA	7879
Dumfries	VA	5217
Dunbar	VA	0
Dungannon	VA	332
Dunn Loring	VA	8803
Eagle Rock	VA	0
Earlysville	VA	0
East Hampton	VA	147993
East Highland Park	VA	14796
East Lexington	VA	1463
East Stone Gap	VA	0
Eastville	VA	167
Ebony	VA	161
Edinburg	VA	1069
Eggleston	VA	0
Elkton	VA	2809
Elliston	VA	902
Emory	VA	1251
Emporia	VA	5496
Enon	VA	3466
Esmont	VA	528
Ettrick	VA	6682
Ewing	VA	439
Exmore	VA	1447
Fair Lakes	VA	0
Fair Oaks	VA	0
Fairfax	VA	24013
Fairfax Station	VA	12030
Fairfield	VA	0
Fairlawn	VA	2367
Fairview	VA	240
Fairview Beach	VA	391
Falls Church	VA	13892
Falls Mills	VA	0
Falmouth	VA	4274
Fancy Gap	VA	237
Farmville	VA	8169
Ferrum	VA	2043
Fieldale	VA	879
Fincastle	VA	341
Fishers Hill	VA	0
Fishersville	VA	7462
Flint Hill	VA	209
Floris	VA	8375
Floyd	VA	439
Forest	VA	9106
Forestville	VA	0
Fort Belvoir	VA	7100
Fort Chiswell	VA	939
Fort Hunt	VA	16045
Fort Lee	VA	9874
Franconia	VA	18245
Franklin	VA	8490
Franklin Farm	VA	0
Franktown	VA	0
Fredericksburg	VA	28118
Free Union	VA	193
Fries	VA	469
Front Royal	VA	15070
Gainesville	VA	11481
Galax	VA	6914
Gargatha	VA	381
Gasburg	VA	481
Gate	VA	0
Gate City	VA	1955
George Mason	VA	0
Glade Spring	VA	1453
Glasgow	VA	1115
Glen Allen	VA	14774
Glen Lyn	VA	117
Glen Wilton	VA	0
Glenvar	VA	976
Gloucester Courthouse	VA	2951
Gloucester Point	VA	9402
Goochland	VA	861
Goose Creek	VA	0
Gordonsville	VA	1577
Gore	VA	0
Goshen	VA	354
Gratton	VA	937
Great Falls	VA	15427
Great Falls Crossing	VA	0
Greenbackville	VA	192
Greenbriar	VA	8166
Greenbush	VA	220
Greenville	VA	832
Gretna	VA	1248
Grottoes	VA	2758
Groveton	VA	14598
Grundy	VA	978
Gwynn	VA	602
Halifax	VA	1249
Hallwood	VA	204
Hamilton	VA	609
Hampden Sydney	VA	1450
Hampden-Sydney	VA	0
Hampton	VA	137148
Hanover	VA	252
Harborton	VA	131
Harrisonburg	VA	52538
Harriston	VA	909
Hayfield	VA	3909
Haymarket	VA	1980
Haysi	VA	472
Heathsville	VA	142
Henry Fork	VA	1234
Herndon	VA	24568
Highland Springs	VA	15711
Hillsboro	VA	123
Hillsville	VA	2677
Hilltown	VA	0
Hiltons	VA	0
Hiwassee	VA	264
Hollins	VA	14673
Hollymead	VA	7690
Honaker	VA	1392
Hopewell	VA	22378
Horntown	VA	574
Horse Pasture	VA	2227
Hot Springs	VA	738
Hudson Crossroads	VA	0
Huntington	VA	11267
Hurt	VA	1274
Hutchison	VA	0
Hybla Valley	VA	15801
Idylwood	VA	17288
Independence	VA	927
Independent Hill	VA	7419
Innovation	VA	0
Innsbrook	VA	0
Iron Gate	VA	379
Irvington	VA	415
Ivanhoe	VA	551
Ivor	VA	328
Ivy	VA	905
Jarratt	VA	619
Jewell Ridge	VA	0
Jolivue	VA	1129
Jonesville	VA	974
Keezletown	VA	0
Keller	VA	176
Kenbridge	VA	1227
Keokee	VA	416
Keswick	VA	0
Keysville	VA	812
Kilmarnock	VA	1437
Kincora	VA	0
King and Queen Court House	VA	85
King George	VA	4457
King William	VA	252
Kings Park	VA	4333
Kings Park West	VA	13390
Kingstowne	VA	0
La Crosse	VA	589
Lafayette	VA	449
Lake Barcroft	VA	9558
Lake Caroline	VA	0
Lake Holiday	VA	0
Lake Land'Or	VA	0
Lake Monticello	VA	9920
Lake of the Woods	VA	7177
Lake Ridge	VA	41058
Lake Wilderness	VA	0
Lakeside	VA	11849
Lancaster	VA	0
Lansdowne	VA	0
Laurel	VA	16713
Laurel Hill	VA	6855
Laurel Park	VA	842
Lawrenceville	VA	1078
Laymantown	VA	1979
Lebanon	VA	3342
Lebanon Church	VA	0
Lee Mont	VA	125
Leesburg	VA	51209
Leesylvania	VA	0
Lexington	VA	7262
Lincolnia	VA	22855
Linton Hall	VA	35725
Linville	VA	0
Loch Lomond	VA	3701
Locust Grove	VA	0
Locust Mount	VA	0
Long Branch	VA	0
Lorton	VA	18610
Loudoun Valley Estates	VA	3656
Louisa	VA	1621
Lovettsville	VA	1934
Lovingston	VA	520
Low Moor	VA	258
Lowes Island	VA	10756
Lunenburg	VA	165
Luray	VA	4828
Lynchburg	VA	79812
Lyndhurst	VA	1490
Madison	VA	220
Madison Heights	VA	11285
Makemie Park	VA	155
Mallow	VA	0
Manassas	VA	41764
Manassas Park	VA	15726
Manchester	VA	0
Mantua	VA	7135
Mappsburg	VA	60
Mappsville	VA	440
Marion	VA	5957
Marshall	VA	1480
Martinsville	VA	13645
Mason Neck	VA	0
Massanetta Springs	VA	4833
Massanutten	VA	2291
Mathews	VA	555
Matoaca	VA	2403
Maurertown	VA	770
Max Meadows	VA	562
McDowell	VA	0
McGaheysville	VA	0
McKenney	VA	481
McLean	VA	48115
McMullin	VA	464
McNair	VA	0
Meadowbrook	VA	18312
Meadows of Dan	VA	0
Meadowview	VA	967
Mechanicsburg	VA	0
Mechanicsville	VA	36348
Melfa	VA	400
Mendota	VA	0
Merrifield	VA	15212
Merrimac	VA	2133
Metompkin	VA	551
Middlebrook	VA	213
Middleburg	VA	807
Middletown	VA	1315
Midland	VA	218
Midlothian	VA	18320
Millboro	VA	0
Mineral	VA	483
Modest	VA	0
Modest Town	VA	149
Moneta	VA	0
Montclair	VA	19570
Monterey	VA	136
Montrose	VA	7993
Montross	VA	389
Montvale	VA	698
Moorefield	VA	0
Moorefield Station	VA	77
Motley	VA	1015
Mount Clifton	VA	0
Mount Crawford	VA	445
Mount Hermon	VA	3966
Mount Jackson	VA	2042
Mount Olive	VA	0
Mount Sidney	VA	663
Mount Vernon	VA	12416
Mountain Road	VA	1100
Narrows	VA	2171
Nassawadox	VA	495
Nathalie	VA	183
Navy	VA	0
Nellysford	VA	1076
Nelsonia	VA	523
New Baltimore	VA	8119
New Castle	VA	152
New Church	VA	205
New Hope	VA	797
New Kent	VA	239
New Market	VA	2208
New River	VA	244
Newington	VA	12943
Newington Forest	VA	0
Newport News	VA	186247
Newsoms	VA	310
Nickelsville	VA	371
Nokesville	VA	1354
Norfolk	VA	238005
North Garden	VA	0
North Shore	VA	3094
North Springfield	VA	7274
Norton	VA	3939
Nottoway Court House	VA	84
Oak Grove	VA	1777
Oak Hall	VA	255
Oak Hill	VA	33811
Oak Level	VA	857
Oakton	VA	34166
Occoquan	VA	1025
Onancock	VA	1261
One Loudoun	VA	0
Onley	VA	516
Opal	VA	691
Orange	VA	4947
Orkney Springs	VA	0
Osaka	VA	132
Painter	VA	227
Palmyra	VA	104
Pamplin	VA	219
Pannill Fork	VA	3027
Pantops	VA	3027
Paris	VA	0
Parksley	VA	840
Parrott	VA	435
Passapatanzy	VA	1283
Pastoria	VA	649
Patrick Springs	VA	1845
Pearisburg	VA	2678
Pembroke	VA	1081
Penhook	VA	801
Pennington Gap	VA	1805
Petersburg	VA	32477
Phenix	VA	219
Pimmit Hills	VA	6094
Piney Mountain	VA	0
Plum Creek	VA	1524
Pocahontas	VA	406
Poquoson	VA	12059
Port Republic	VA	0
Port Royal	VA	129
Portsmouth	VA	96201
Portsmouth Heights	VA	99049
Potomac Mills	VA	5614
Pound	VA	966
Pounding Mill	VA	0
Powhatan	VA	0
Prices Fork	VA	1066
Prince George	VA	2066
Pulaski	VA	8890
Pungoteague	VA	347
Purcellville	VA	9232
Quantico	VA	480
Quantico Base	VA	0
Quicksburg	VA	0
Quinby	VA	282
Radford	VA	17403
Raven	VA	2270
Ravensworth	VA	2466
Rectortown	VA	0
Remington	VA	627
Reston	VA	58404
Rhoadesville	VA	0
Rich Creek	VA	748
Richlands	VA	5504
Richmond	VA	226610
Ridgeway	VA	797
Riner	VA	859
Rio	VA	0
Ripplemead	VA	0
Rivanna	VA	0
Riverdale	VA	956
Riverview	VA	782
Roanoke	VA	100011
Rockwood	VA	0
Rocky Gap	VA	0
Rocky Mount	VA	4799
Rose Glen	VA	100
Rose Hill	VA	20226
Rosslyn	VA	9599
Round Hill	VA	641
Ruckersville	VA	1141
Rural Retreat	VA	1485
Rushmere	VA	1018
Rustburg	VA	1431
Saint Charles	VA	128
Saint Paul	VA	970
Salem	VA	25432
Saltville	VA	2031
Saluda	VA	769
Sandston	VA	7571
Sandy Level	VA	484
Sanford	VA	212
Saumsville	VA	0
Savage	VA	0
Savage Town	VA	78
Savageville	VA	175
Saxis	VA	239
Schooner Bay	VA	0
Schuyler	VA	298
Scotland	VA	203
Scottsburg	VA	132
Scottsville	VA	603
Sedley	VA	470
Selma	VA	529
Seven Corners	VA	9255
Seven Mile Ford	VA	783
Shawnee Land	VA	1873
Shawneeland	VA	0
Shawsville	VA	1310
Shenandoah	VA	2340
Shenandoah Farms	VA	3033
Shenandoah Retreat	VA	518
Shenandoah Shores	VA	934
Sherando	VA	688
Shipman	VA	507
Short Pump	VA	24729
Singers Glen	VA	0
Skyland Estates	VA	830
Smithfield	VA	8364
Snowville	VA	149
South Boston	VA	7976
South Hill	VA	4527
South Riding	VA	24256
South Run	VA	0
South Suffolk	VA	80690
Southampton Meadows	VA	0
Southern Gateway	VA	2805
Southside Chesconessex	VA	131
Sperryville	VA	342
Spotsylvania Courthouse	VA	4239
Springfield	VA	30484
Springville	VA	1371
St. Charles	VA	0
St. Paul	VA	0
Stafford	VA	4320
Stafford Courthouse	VA	0
Stanardsville	VA	380
Stanley	VA	1654
Stanleytown	VA	1422
Staunton	VA	24416
Stephens	VA	0
Stephens City	VA	1940
Sterling	VA	27822
Stevens Creek	VA	0
Stewartsville	VA	0
Stickleyville	VA	0
Stingray Point	VA	250
Stone Ridge	VA	0
Stonega	VA	0
Stony Creek	VA	190
Strasburg	VA	6586
Stuart	VA	1442
Stuarts Draft	VA	9235
Sudley	VA	16203
Suffolk	VA	88161
Sugar Grove	VA	758
Sugarland Run	VA	11799
Sully Square	VA	0
Surry	VA	232
Sussex	VA	256
Tacoma	VA	204
Tangier	VA	726
Tappahannock	VA	2387
Tasley	VA	300
Tazewell	VA	4421
Temperanceville	VA	358
Templeton	VA	431
The Plains	VA	226
The University of Virginia's College at Wise	VA	0
Thynedale	VA	197
Timberlake	VA	12183
Timberville	VA	2603
Toms Brook	VA	262
Triangle	VA	8188
Trout Dale	VA	178
Troutdale	VA	0
Troutville	VA	432
Tuckahoe	VA	44990
Twin Lakes	VA	1647
Tysons	VA	19627
Union Hall	VA	1138
Union Level	VA	188
Union Mill	VA	0
Unionville	VA	0
University Center	VA	3586
University of Virginia	VA	0
Upperville	VA	0
Urbanna	VA	463
Vansant	VA	470
Verona	VA	4239
Victoria	VA	1677
Vienna	VA	16522
Villa Heights	VA	827
Vinton	VA	8231
Virgilina	VA	143
Virginia Beach	VA	454808
Wachapreague	VA	230
Wakefield	VA	884
Warfield	VA	115
Warm Springs	VA	123
Warrenton	VA	9897
Warsaw	VA	1495
Washington	VA	128
Waterford	VA	0
Wattsville	VA	1128
Waverly	VA	2073
Waynesboro	VA	21491
Weber	VA	0
Weber City	VA	1276
Weems	VA	0
West Falls Church	VA	29207
West Gate	VA	8046
West Lynchburg	VA	65517
West Point	VA	3333
West Springfield	VA	22460
Westlake Corner	VA	976
Weyers Cave	VA	2473
White Stone	VA	342
Whitesville	VA	219
Williamsburg	VA	15052
Willis Wharf	VA	0
Winchester	VA	27284
Windsor	VA	2671
Wintergreen	VA	165
Wise	VA	3119
Wolf Trap	VA	16131
Woodberry Forest	VA	112
Woodbridge	VA	4055
Woodburn	VA	8480
Woodlake	VA	7319
Woodlawn	VA	20804
Woodstock	VA	5248
Wyndham	VA	9785
Wytheville	VA	8115
Yogaville	VA	226
York Haven Anchorage	VA	226
Yorkshire	VA	7541
Yorktown	VA	195
Addison	VT	1361
Albany	VT	186
Alburg	VT	497
Alburgh	VT	0
Algiers	VT	0
Arlington	VT	1213
Ascutney	VT	540
Athens	VT	380
Averill	VT	24
Bakersfield	VT	0
Barnet	VT	129
Barre	VT	8746
Barton	VT	700
Beebe Plain	VT	854
Beecher Falls	VT	177
Bellows Falls	VT	3048
Bennington	VT	9074
Benson	VT	308
Bethel	VT	569
Bloomfield	VT	217
Bolton	VT	0
Bolton Valley	VT	0
Bradford	VT	788
Brandon	VT	1648
Brattleboro	VT	7414
Bread Loaf	VT	1
Bridport	VT	1215
Bristol	VT	2030
Burlington	VT	42452
Cabot	VT	233
Cambridge	VT	238
Canaan	VT	392
Castleton	VT	1485
Castleton Four Corners	VT	0
Cavendish	VT	179
Charlotte	VT	3861
Chelsea	VT	1242
Chester	VT	2994
Chimney Hill	VT	0
Chittenden	VT	1231
Clarendon	VT	2489
Colchester	VT	16986
Concord	VT	271
Coventry	VT	97
Danby	VT	1286
Danville	VT	383
Derby Center	VT	576
Derby Line	VT	651
Dorset	VT	249
Dover	VT	1437
East Barre	VT	826
East Burke	VT	132
East Charlotte	VT	0
East Dorset	VT	0
East Haven	VT	288
East Middlebury	VT	425
East Montpelier	VT	80
East Poultney	VT	0
Enosburg Falls	VT	1305
Essex Junction	VT	10111
Fair Haven	VT	2269
Fairfax	VT	0
Fairlee	VT	189
Ferrisburgh	VT	2764
Gilman	VT	0
Glastenbury	VT	8
Glover	VT	303
Goshen	VT	164
Grafton	VT	0
Granby	VT	85
Graniteville	VT	784
Granville	VT	302
Greensboro	VT	109
Greensboro Bend	VT	232
Groton	VT	437
Guildhall	VT	256
Hancock	VT	326
Hanksville	VT	0
Hardwick	VT	1345
Harmonyville	VT	0
Hartford	VT	9779
Hartland	VT	380
Highgate Center	VT	0
Highgate Springs	VT	0
Hinesburg	VT	4441
Holland	VT	610
Huntington	VT	0
Huntington Center	VT	0
Hyde Park	VT	492
Irasburg	VT	163
Island Pond	VT	821
Isle La Motte	VT	464
Jacksonville	VT	218
Jamaica	VT	1011
Jeffersonville	VT	753
Jericho	VT	1329
Jericho Center	VT	0
Johnson	VT	1451
Killington	VT	0
Leicester	VT	1114
Lincoln	VT	1268
Londonderry	VT	1742
Lowell	VT	228
Ludlow	VT	794
Lunenburg	VT	1281
Lyndon	VT	5496
Lyndon Center	VT	0
Lyndonville	VT	1190
Maidstone	VT	203
Manchester	VT	740
Manchester Center	VT	2120
Marshfield	VT	263
Mendon	VT	1033
Middlebury	VT	0
Middlebury (village)	VT	6588
Middlesex	VT	1779
Middletown Springs	VT	0
Milton	VT	1861
Montgomery	VT	1195
Montpelier	VT	8074
Moretown	VT	1660
Morristown	VT	5653
Morrisville	VT	2040
Mount Holly	VT	1221
Mount Tabor	VT	256
New Haven	VT	0
Newbury	VT	363
Newfane	VT	114
Newport	VT	4442
Newport Center	VT	274
North Bennington	VT	1620
North Clarendon	VT	0
North Hartland	VT	302
North Hero	VT	793
North Hyde Park	VT	0
North Pownal	VT	0
North Springfield	VT	573
North Troy	VT	594
North Westminster	VT	247
Northfield	VT	2101
Norton	VT	160
Norwich	VT	878
Old Bennington	VT	138
Orleans	VT	818
Pawlet	VT	1426
Peacham	VT	0
Perkinsville	VT	128
Pittsfield	VT	543
Pittsford	VT	740
Plainfield	VT	401
Poultney	VT	1569
Pownal	VT	3460
Pownal Center	VT	0
Proctor	VT	0
Proctorsville	VT	454
Putney	VT	523
Quechee	VT	656
Randolph	VT	1974
Readsboro	VT	321
Richford	VT	1361
Richmond	VT	723
Ripton	VT	593
Rochester	VT	299
Rockingham	VT	5198
Rupert	VT	700
Rutland	VT	15824
Saint Albans	VT	6918
Saint Johnsbury	VT	6193
Salisbury	VT	1131
Saxtons River	VT	552
Searsburg	VT	107
Sheffield	VT	0
Shelburne	VT	592
Somerset	VT	3
South Barre	VT	1219
South Burlington	VT	18791
South Hero	VT	0
South Lincoln	VT	0
South Londonderry	VT	0
South Royalton	VT	694
South Shaftsbury	VT	683
South Woodstock	VT	0
Springfield	VT	3979
St Johnsbury	VT	7571
St. Albans	VT	0
St. George	VT	0
St. Johnsbury	VT	0
Stamford	VT	0
Starksboro	VT	1776
Stowe	VT	4314
Stratton	VT	210
Stratton Mountain	VT	0
Sutton	VT	0
Swanton	VT	2370
Townshend	VT	1205
Troy	VT	243
Underhill Center	VT	0
Underhill Flats	VT	0
Vergennes	VT	2631
Victory	VT	60
Waitsfield	VT	164
Wallingford	VT	830
Wardsboro	VT	0
Washington	VT	1035
Waterbury	VT	1821
Waterbury Center	VT	0
Websterville	VT	550
Wells	VT	397
Wells River	VT	394
West Brattleboro	VT	2740
West Burke	VT	336
West Charlotte	VT	0
West Dummerston	VT	0
West Milton	VT	480
West Pawlet	VT	502
West Rutland	VT	2024
West Woodstock	VT	0
Westford	VT	0
Westminster	VT	282
Weston	VT	570
White River Junction	VT	2286
White River Junction VA Medical Center	VT	2286
Whitingham	VT	0
Wilder	VT	1690
Williamstown	VT	1162
Williston	VT	8314
Wilmington	VT	463
Windsor	VT	2066
Winooski	VT	7193
Wolcott	VT	0
Woodford	VT	410
Woodstock	VT	871
Worcester	VT	112
Aberdeen	WA	16276
Aberdeen Gardens	WA	279
Acme	WA	246
Addy	WA	268
Ahtanum	WA	3601
Airway Heights	WA	6639
Albion	WA	578
Alder	WA	227
Alderton	WA	2893
Alderwood Manor	WA	8442
Alger	WA	403
Algona	WA	3144
Allyn	WA	1963
Almira	WA	269
Altoona	WA	39
Amanda Park	WA	252
Amboy	WA	1608
Ames Lake	WA	1486
Anacortes	WA	18103
Anatone	WA	0
Anderson Island	WA	0
Arlington	WA	18949
Arlington Heights	WA	2284
Artondale	WA	12653
Ashford	WA	217
Asotin	WA	1282
Auburn	WA	77006
Ault Field	WA	1541
Bainbridge Island	WA	23840
Bangor Base	WA	0
Bangor Trident Base	WA	6054
Banks Lake South	WA	174
Barberton	WA	5661
Baring	WA	220
Barney's Junction	WA	0
Barstow	WA	59
Basin	WA	0
Basin City	WA	1092
Battle Ground	WA	19407
Bay Center	WA	276
Bay View	WA	696
Beacon Hill	WA	0
Beaux Arts	WA	0
Beaux Arts Village	WA	324
Belfair	WA	3931
Bell Hill	WA	837
Bellevue	WA	139820
Bellingham	WA	85146
Benton	WA	0
Benton City	WA	3234
Bethel	WA	3713
Beverly	WA	0
Bickleton	WA	88
Big Lake	WA	1835
Bingen	WA	721
Birch Bay	WA	8413
Black Diamond	WA	4376
Blaine	WA	5056
Blyn	WA	101
Bonney Lake	WA	19903
Bothell	WA	42939
Bothell East	WA	8018
Bothell West	WA	16607
Boulevard Park	WA	5287
Bow	WA	0
Boyds	WA	34
Brady	WA	676
Bremerton	WA	39520
Brewster	WA	2354
Bridgeport	WA	2457
Brier	WA	6656
Brinnon	WA	797
Browns Point	WA	1198
Brush Prairie	WA	2652
Bryant	WA	1870
Bryn Mawr-Skyway	WA	15645
Buckley	WA	4550
Bucoda	WA	566
Buena	WA	990
Bunk Foss	WA	3570
Burbank	WA	3291
Burien	WA	50467
Burley	WA	2057
Burlington	WA	8633
Camano	WA	14202
Camas	WA	21846
Canterwood	WA	3079
Canyon Creek	WA	0
Carbonado	WA	625
Carlsborg	WA	995
Carnation	WA	1873
Carson	WA	2279
Cascade Valley	WA	2246
Cashmere	WA	3159
Castle Rock	WA	2184
Cathan	WA	567
Cathcart	WA	2458
Cathlamet	WA	532
Cavalero	WA	0
Centerville	WA	112
Central Park	WA	2685
Centralia	WA	16753
Chain Lake	WA	0
Chehalis	WA	7391
Chehalis Village	WA	372
Chelan	WA	4060
Chelan Falls	WA	329
Cheney	WA	11534
Cherry Grove	WA	546
Chewelah	WA	2607
Chico	WA	2259
Chinook	WA	466
City of Sammamish	WA	45780
Clallam Bay	WA	363
Clarkston	WA	7317
Clarkston Heights-Vineland	WA	6326
Clayton	WA	0
Cle Elum	WA	1901
Clear Lake	WA	1002
Clearview	WA	3324
Cliffdell	WA	104
Clinton	WA	928
Clover Creek	WA	0
Clyde Hill	WA	3230
Cohassett Beach	WA	722
Colfax	WA	2870
College Place	WA	9062
Colton	WA	445
Columbia City	WA	19000
Colville	WA	4719
Conconully	WA	213
Concrete	WA	716
Connell	WA	5446
Conway	WA	91
Copalis Beach	WA	415
Cosmopolis	WA	1594
Cottage Lake	WA	22494
Cougar	WA	0
Coulee	WA	0
Coulee City	WA	572
Coulee Dam	WA	1093
Country Homes	WA	5841
Coupeville	WA	1887
Covington	WA	19197
Cowiche	WA	428
Crescent Bar	WA	0
Creston	WA	216
Crocker	WA	1268
Curlew	WA	118
Curlew Lake	WA	0
Cusick	WA	205
Custer	WA	366
Dallesport	WA	1202
Danville	WA	34
Darrington	WA	1376
Dash Point	WA	931
Davenport	WA	1672
Dayton	WA	2526
Deep River	WA	204
Deer Park	WA	3941
Deming	WA	353
Des Moines	WA	31221
Desert Aire	WA	1626
Disautel	WA	78
Dishman	WA	9978
Dixie	WA	197
Dollar Corner	WA	1108
Dollars Corner	WA	0
Donald	WA	91
Duluth	WA	0
DuPont	WA	9356
Duvall	WA	7674
East Cathlamet	WA	491
East Hill-Meridian	WA	29878
East Port Orchard	WA	5919
East Renton Highlands	WA	11140
East Wenatchee	WA	13659
East Wenatchee Bench	WA	8856
Eastgate	WA	4958
Eastmont	WA	20101
Easton	WA	478
Eatonville	WA	2900
Echo Lake	WA	849
Edgewood	WA	9826
Edison	WA	133
Edmonds	WA	41375
Elbe	WA	29
Electric	WA	0
Electric City	WA	1012
Elk Plain	WA	14205
Ellensburg	WA	19001
Elma	WA	3034
Elmer	WA	0
Elmer City	WA	240
Endicott	WA	290
Enetai	WA	2286
Entiat	WA	1182
Enumclaw	WA	11609
Ephrata	WA	8047
Erlands Point	WA	0
Erlands Point-Kitsap Lake	WA	2935
Eschbach	WA	415
Esperance	WA	3601
Everett	WA	108010
Everson	WA	2600
Fairchild AFB	WA	0
Fairchild Air Force Base	WA	2776
Fairfield	WA	606
Fairwood	WA	19102
Fall	WA	0
Fall City	WA	1993
Farmington	WA	150
Federal Way	WA	95171
Felida	WA	7385
Fern Prairie	WA	1884
Ferndale	WA	13010
Fife	WA	9970
Fife Heights	WA	2137
Finley	WA	6012
Fircrest	WA	6687
Five Corners	WA	18159
Fobes Hill	WA	2418
Fords Prairie	WA	1959
Forks	WA	3747
Fort Lewis	WA	0
Four Lakes	WA	512
Fox Island	WA	3633
Frederickson	WA	18719
Freeland	WA	2045
Friday Harbor	WA	2340
Garfield	WA	604
Garrett	WA	1419
Geneva	WA	2321
George	WA	501
Gig Harbor	WA	8753
Glacier	WA	211
Gleed	WA	2906
Glenwood	WA	0
Gold Bar	WA	2112
Goldendale	WA	3435
Gorst	WA	592
Graham	WA	23491
Grand Coulee	WA	1043
Grand Mound	WA	2981
Grandview	WA	11176
Granger	WA	3695
Granite Falls	WA	3493
Grapeview	WA	954
Grayland	WA	953
Grays River	WA	263
Green Bluff	WA	761
Greenwater	WA	67
Greenwood	WA	12378
Hamilton	WA	298
Hansville	WA	3091
Harrah	WA	628
Harrington	WA	400
Hartline	WA	156
Hat Island	WA	41
Hatton	WA	102
Hazel Dell	WA	19435
Herron Island	WA	0
High Bridge	WA	0
Highland	WA	3197
Hobart	WA	6221
Hockinson	WA	4771
Hogans Corner	WA	0
Home	WA	1377
Hoodsport	WA	376
Hoquiam	WA	8405
Humptulips	WA	255
Hunts Point	WA	438
Ilwaco	WA	917
Inchelium	WA	409
Index	WA	194
Indianola	WA	3500
Inglewood-Finn Hill	WA	22707
Ione	WA	451
Issaquah	WA	36081
Jamestown	WA	361
John Sam Lake	WA	956
Joint Base Lewis McChord	WA	11046
Junction City	WA	18
Kahlotus	WA	190
Kalama	WA	2398
Kapowsin	WA	333
Kayak Point	WA	0
Keller	WA	234
Kelso	WA	11901
Kendall	WA	191
Kenmore	WA	22030
Kennewick	WA	78896
Kent	WA	126952
Ketron	WA	17
Ketron Island	WA	0
Kettle Falls	WA	1597
Key Center	WA	3692
Keyport	WA	554
Kingsgate	WA	13065
Kingston	WA	2099
Kirkland	WA	87281
Kitsap Lake	WA	0
Kittitas	WA	1430
Klahanie	WA	10674
Klickitat	WA	362
Krupp	WA	0
La Center	WA	3125
La Conner	WA	927
La Crosse	WA	313
La Grande	WA	109
Lacey	WA	46409
LaCrosse	WA	0
Lake Bosworth	WA	667
Lake Cassidy	WA	0
Lake Cavanaugh	WA	167
Lake Forest Park	WA	13243
Lake Goodwin	WA	0
Lake Holm	WA	0
Lake Ketchum	WA	930
Lake Marcel-Stillwater	WA	1277
Lake McMurray	WA	192
Lake Morton-Berrydale	WA	10160
Lake Roesiger	WA	503
Lake Shore	WA	6571
Lake Stevens	WA	30886
Lake Stickney	WA	7777
Lake Tapps	WA	0
Lakeland North	WA	12942
Lakeland South	WA	11574
Lakeview	WA	915
Lakewood	WA	59829
Lamont	WA	72
Langley	WA	1077
Larch Way	WA	3318
Latah	WA	185
Laurier	WA	1
Lea Hill	WA	13182
Leavenworth	WA	2002
Lebam	WA	160
Lewisville	WA	1722
Lexington	WA	0
Liberty Lake	WA	8906
Lind	WA	567
Lochsloy	WA	2533
Lofall	WA	2289
Long Beach	WA	1364
Longbranch	WA	3784
Longview	WA	36848
Longview Heights	WA	3851
Loomis	WA	159
Loon Lake	WA	783
Lower Elochoman	WA	0
Lyle	WA	499
Lyman	WA	450
Lynden	WA	13517
Lynnwood	WA	36997
Mabton	WA	2302
Machias	WA	1178
Malden	WA	202
Malo	WA	28
Malone	WA	475
Malott	WA	487
Maltby	WA	10830
Manchester	WA	5413
Mansfield	WA	329
Manson	WA	1468
Maple Falls	WA	324
Maple Heights-Lake Desire	WA	3152
Maple Valley	WA	25686
Maplewood	WA	5138
Marblemount	WA	203
Marcus	WA	184
Marietta	WA	2766
Marietta-Alderwood	WA	3906
Marine View	WA	0
Markham	WA	111
Marlin	WA	55
Marrowstone	WA	844
Martha Lake	WA	15473
Maryhill	WA	58
Marysville	WA	66773
Mattawa	WA	4548
May Creek	WA	818
McChord AFB	WA	0
McChord Air Force Base	WA	2507
McCleary	WA	1618
McKenna	WA	716
McMillin	WA	1547
Mead	WA	7275
Meadow Glade	WA	2541
Meadowdale	WA	2826
Medical Lake	WA	4942
Medina	WA	3226
Mercer Island	WA	25042
Mesa	WA	488
Metaline	WA	172
Metaline Falls	WA	241
Methow	WA	68
Midland	WA	8962
Mill Creek	WA	20043
Mill Creek East	WA	15709
Mill Plain	WA	7874
Millwood	WA	1783
Milton	WA	8697
Mineral	WA	202
Minnehaha	WA	9771
Mirrormont	WA	3659
Moclips	WA	207
Monroe	WA	18090
Monroe North	WA	1666
Montesano	WA	3891
Morton	WA	1128
Moses Lake	WA	22082
Moses Lake North	WA	4418
Mossyrock	WA	751
Mount Vernon	WA	34053
Mount Vista	WA	7850
Mountlake Terrace	WA	20989
Moxee	WA	0
Moxee City	WA	821
Mukilteo	WA	21226
Naches	WA	805
Napavine	WA	1789
Naselle	WA	419
Navy Yard	WA	0
Navy Yard City	WA	2477
Neah Bay	WA	865
Neilton	WA	315
Nespelem	WA	256
Nespelem Community	WA	253
Newcastle	WA	11370
Newport	WA	2218
Nile	WA	140
Nisqually Indian Community	WA	575
Nooksack	WA	1480
Normandy Park	WA	6668
North Bend	WA	6679
North Bonneville	WA	971
North Creek	WA	26410
North Fort Lewis	WA	2699
North Lynnwood	WA	0
North Marysville	WA	108
North Omak	WA	688
North Puyallup	WA	1743
North Stanwood	WA	498
North Sultan	WA	264
North Yelm	WA	2906
Northport	WA	288
Northwest Stanwood	WA	149
Oak Harbor	WA	22693
Oakesdale	WA	429
Oakville	WA	663
Ocean	WA	0
Ocean City	WA	200
Ocean Park	WA	1573
Ocean Shores	WA	5699
Ocosta	WA	0
Odessa	WA	871
Okanogan	WA	2569
Olympia	WA	55733
Omak	WA	4854
Onalaska	WA	621
Opportunity	WA	25877
Orcas	WA	394
Orchards	WA	19556
Orient	WA	115
Oroville	WA	1677
Orting	WA	7446
Oso	WA	180
Othello	WA	7809
Otis Orchards-East Farms	WA	6220
Outlook	WA	292
Oyehut	WA	85
Pacific	WA	7123
Pacific Beach	WA	291
Packwood	WA	342
Palouse	WA	1022
Parker	WA	154
Parkland	WA	35803
Parkwood	WA	7126
Pasco	WA	69451
Pataha	WA	0
Pateros	WA	668
Pe Ell	WA	634
Peaceful Valley	WA	3324
Picnic Point	WA	8809
Picnic Point-North Lynnwood	WA	22953
Pine Grove	WA	0
Point Roberts	WA	1314
Pomeroy	WA	1389
Port Angeles	WA	19448
Port Angeles East	WA	3036
Port Gamble Tribal Community	WA	0
Port Hadlock-Irondale	WA	3580
Port Ludlow	WA	2603
Port Orchard	WA	13607
Port Townsend	WA	9335
Porter	WA	207
Poulsbo	WA	10041
Prairie Heights	WA	4405
Prairie Ridge	WA	11464
Prescott	WA	307
Priest Point	WA	799
Prosser	WA	5869
Puget Island	WA	0
Pullman	WA	32816
Purdy	WA	1544
Puyallup	WA	39659
Queets	WA	174
Qui-nai-elt	WA	0
Quilcene	WA	596
Quincy	WA	7365
Raft Island	WA	0
Rainier	WA	1985
Ravensdale	WA	1101
Raymond	WA	2815
Reardan	WA	554
Redmond	WA	60598
Renton	WA	100242
Republic	WA	1072
Richland	WA	54248
Ridgefield	WA	6455
Ritzville	WA	1665
River Road	WA	454
Riverbend	WA	2132
Riverpoint	WA	0
Riverside	WA	336
Riverton	WA	6407
Roche Harbor	WA	0
Rochester	WA	2388
Rock Island	WA	804
Rockford	WA	468
Rockport	WA	109
Rocky Point	WA	1564
Ronald	WA	308
Roosevelt	WA	156
Rosalia	WA	555
Rosburg	WA	317
Rosedale	WA	4044
Roslyn	WA	903
Roy	WA	806
Royal	WA	0
Royal City	WA	2220
Ruston	WA	798
Ryderwood	WA	395
Saint John	WA	537
Salmon Creek	WA	19686
Sammamish	WA	52253
Santiago	WA	42
Satsop	WA	675
Satus	WA	746
Schwana	WA	0
Seabeck	WA	1105
SeaTac	WA	28215
Seattle	WA	780995
Sedro-Woolley	WA	10815
Sekiu	WA	27
Selah	WA	7682
Sequim	WA	6826
Shadow Lake	WA	0
Shaker Church	WA	830
Shelton	WA	9834
Shoreline	WA	55439
Silvana	WA	90
Silver Firs	WA	20891
Silverdale	WA	19204
Sisco Heights	WA	2696
Skamokawa Valley	WA	401
Skokomish	WA	617
Skykomish	WA	207
Smokey Point	WA	1572
Snohomish	WA	9670
Snoqualmie	WA	13169
Snoqualmie Pass	WA	311
Soap Lake	WA	1580
South Bend	WA	1612
South Cle Elum	WA	536
South Creek	WA	0
South Hill	WA	52431
South Prairie	WA	429
South Wenatchee	WA	1553
Southworth	WA	2185
Spanaway	WA	27227
Spangle	WA	291
Spokane	WA	229447
Spokane Valley	WA	94919
Sprague	WA	425
Springdale	WA	275
St. John	WA	0
Stansberry Lake	WA	0
Stanwood	WA	6779
Starbuck	WA	126
Startup	WA	676
Steilacoom	WA	6211
Steptoe	WA	180
Stevenson	WA	1497
Stimson Crossing	WA	857
Sudden Valley	WA	6441
Sultan	WA	4798
Sumas	WA	1373
Summit	WA	7985
Summit View	WA	7236
Summitview	WA	967
Sumner	WA	9700
Suncrest	WA	0
Sunday Lake	WA	0
Sunland Estates	WA	0
Sunnyside	WA	16325
Sunnyslope	WA	3252
Suquamish	WA	4140
Swede Heaven	WA	768
Tacoma	WA	222906
Taholah	WA	840
Tampico	WA	312
Tanglewilde	WA	5892
Tanglewilde-Thompson Place	WA	5892
Tanner	WA	1018
Tehaleh	WA	0
Tekoa	WA	792
Tenino	WA	1749
Terrace Heights	WA	6937
Thorp	WA	240
Three Lakes	WA	3184
Tieton	WA	1253
Tokeland	WA	151
Toledo	WA	727
Tonasket	WA	1016
Toppenish	WA	8995
Torboy	WA	49
Touchet	WA	421
Town and Country	WA	4857
Tracyton	WA	5233
Trentwood	WA	4450
Tri-Cities	WA	244036
Trout Lake	WA	557
Tukwila	WA	20018
Tulalip	WA	9246
Tulalip Bay	WA	1609
Tumwater	WA	19190
Twin Lakes	WA	0
Twisp	WA	942
Union	WA	631
Union Gap	WA	6037
Union Hill-Novelty Hill	WA	18805
Uniontown	WA	329
University Place	WA	32842
Upper Elochoman	WA	0
Vader	WA	620
Valley	WA	146
Vancouver	WA	196442
Vantage	WA	74
Vashon	WA	10624
Vaughn	WA	544
Venersborg	WA	3745
Veradale	WA	9991
Verlot	WA	285
Waitsburg	WA	1191
Walla Walla	WA	32237
Walla Walla East	WA	1672
Waller	WA	7922
Wallula	WA	179
Walnut Grove	WA	9790
Wapato	WA	5068
Warden	WA	2736
Warm Beach	WA	2437
Washougal	WA	15288
Washtucna	WA	202
Waterville	WA	1171
Wauna	WA	4186
Waverly	WA	109
Weallup Lake	WA	974
Wenatchee	WA	33636
West Clarkston-Highland	WA	5261
West Lake Sammamish	WA	33929
West Lake Stevens	WA	21047
West Longview	WA	2698
West Pasco	WA	3739
West Richland	WA	13746
West Side Highway	WA	5517
West Valley	WA	12655
West Wenatchee	WA	1565
Westport	WA	2023
Wheeler	WA	0
Whidbey Island Station	WA	0
White Center	WA	13495
White Salmon	WA	2343
White Swan	WA	793
Wilbur	WA	849
Wilburton	WA	3790
Wilderness Rim	WA	1523
Wilkeson	WA	485
Willapa	WA	210
Wilson Creek	WA	211
Winlock	WA	1320
Winthrop	WA	420
Wishram	WA	342
Wollochet	WA	6651
Woodinville	WA	11782
Woodland	WA	5842
Woods Creek	WA	5589
Woodway	WA	1364
Yacolt	WA	1686
Yakima	WA	93701
Yarrow Point	WA	1081
Yelm	WA	8434
Zillah	WA	3138
Abbotsford	WI	2264
Abrams	WI	340
Adams	WI	1893
Addison	WI	3439
Adell	WI	521
Albany	WI	1018
Algoma	WI	3094
Allens Grove	WI	0
Allenton	WI	823
Allouez	WI	13930
Alma	WI	748
Alma Center	WI	495
Almena	WI	663
Almond	WI	433
Alto	WI	1048
Altoona	WI	7321
Amberg	WI	180
Amery	WI	2834
Amherst	WI	1038
Amherst Junction	WI	374
Angelica	WI	92
Aniwa	WI	246
Antigo	WI	7869
Appleton	WI	74139
Arcadia	WI	2991
Arena	WI	828
Argonne	WI	160
Argyle	WI	848
Arkansaw	WI	177
Arkdale	WI	158
Arlington	WI	812
Arpin	WI	323
Ashford	WI	1725
Ashippun	WI	333
Ashland	WI	8040
Ashwaubenon	WI	17176
Athens	WI	1096
Auburndale	WI	673
Augusta	WI	1532
Avoca	WI	627
Aztalan	WI	1485
Babcock	WI	126
Bagley	WI	364
Baileys Harbor	WI	257
Baldwin	WI	3972
Balsam Lake	WI	991
Bancroft	WI	535
Bangor	WI	1492
Baraboo	WI	12155
Barneveld	WI	1232
Barron	WI	3322
Barronett	WI	111
Barton	WI	2615
Batavia	WI	0
Bay	WI	0
Bay City	WI	484
Bayfield	WI	479
Bayfront	WI	0
Bayside	WI	4419
Bear Creek	WI	436
Beaver Dam	WI	16564
Belgium	WI	2261
Bell Center	WI	115
Belle Plaine	WI	1846
Belleville	WI	2425
Bellevue	WI	15317
Belmont	WI	986
Beloit	WI	36891
Benton	WI	964
Berlin	WI	5420
Bevent	WI	1115
Big Bend	WI	1312
Big Falls	WI	60
Big Foot Prairie	WI	22
Birch Hill	WI	293
Birchwood	WI	425
Birnamwood	WI	798
Biron	WI	804
Black Creek	WI	1322
Black Earth	WI	1403
Black River Falls	WI	3564
Blair	WI	1351
Blanchardville	WI	818
Bloomer	WI	3520
Bloomfield	WI	0
Bloomington	WI	718
Blue Mounds	WI	938
Blue River	WI	420
Bluffview	WI	742
Boaz	WI	151
Bohners Lake	WI	2444
Bonduel	WI	1456
Boscobel	WI	3189
Boulder Junction	WI	183
Bowler	WI	298
Boyceville	WI	1103
Boyd	WI	540
Brandon	WI	859
Brice Prairie	WI	1887
Briggsville	WI	0
Brillion	WI	3142
Bristol	WI	4951
Brodhead	WI	3291
Brokaw	WI	252
Brookfield	WI	38025
Brooklyn	WI	1449
Brothertown	WI	1321
Brown Deer	WI	12102
Browns Lake	WI	2039
Brownsville	WI	582
Browntown	WI	283
Bruce	WI	729
Brule	WI	254
Brussels	WI	1110
Buffalo	WI	0
Buffalo City	WI	973
Burlington	WI	10650
Burnett	WI	256
Butler	WI	1825
Butte des Morts	WI	962
Butternut	WI	364
Cable	WI	206
Cadott	WI	1426
Caledonia	WI	24684
Cambria	WI	754
Cambridge	WI	1494
Cameron	WI	1795
Camp Douglas	WI	607
Camp Lake	WI	3665
Campbellsport	WI	1978
Caroline	WI	270
Cascade	WI	701
Casco	WI	578
Cashton	WI	1097
Cassville	WI	924
Castle Rock	WI	255
Cataract	WI	186
Catawba	WI	106
Cato	WI	1546
Cazenovia	WI	324
Cecil	WI	554
Cedar Grove	WI	2112
Cedarburg	WI	11482
Ceex Haci	WI	0
Centuria	WI	925
Chain O' Lakes	WI	0
Chaseburg	WI	302
Chelsea	WI	113
Chenequa	WI	603
Chetek	WI	2191
Chief Lake	WI	583
Chili	WI	226
Chilton	WI	3896
Chippewa Falls	WI	14047
Clam Falls	WI	588
Clam Lake	WI	37
Clarks Mills	WI	0
Clayton	WI	550
Clear Lake	WI	1040
Cleveland	WI	1468
Clinton	WI	2140
Clintonville	WI	4455
Clyman	WI	404
Cobb	WI	463
Cochrane	WI	425
Colby	WI	1828
Coleman	WI	705
Colfax	WI	1161
Collins	WI	164
Coloma	WI	438
Columbus	WI	4996
Combined Locks	WI	3532
Commonwealth	WI	403
Como	WI	2631
Concord	WI	2070
Conrath	WI	92
Coon Valley	WI	780
Cooperstown	WI	1278
Cornell	WI	1440
Cornucopia	WI	98
Cottage Grove	WI	6854
Couderay	WI	87
Crandon	WI	1863
Crivitz	WI	965
Cross Plains	WI	4000
Cuba	WI	0
Cuba City	WI	2055
Cudahy	WI	18353
Cumberland	WI	2146
Curtiss	WI	215
Dakota	WI	1207
Dale	WI	528
Dallas	WI	390
Dalton	WI	206
Danbury	WI	172
Dane	WI	1120
Darien	WI	1610
Darlington	WI	2405
De Pere	WI	24724
De Soto	WI	288
Decatur	WI	1803
Deer Park	WI	218
Deerfield	WI	2499
DeForest	WI	8936
Dekorra	WI	0
Delafield	WI	7180
Delavan	WI	8389
Delavan Lake	WI	2649
Dellwood	WI	563
Denmark	WI	2193
Diamond Bluff	WI	194
Diaperville	WI	70
Dickeyville	WI	1039
Dodge	WI	121
Dodgeville	WI	4652
Dorchester	WI	862
Dousman	WI	2335
Downing	WI	270
Downsville	WI	146
Doylestown	WI	295
Dresser	WI	860
Drummond	WI	154
Dunbar	WI	50
Durand	WI	1847
Dyckesville	WI	538
Eagle	WI	1974
Eagle Lake	WI	1192
Eagle River	WI	1363
East Troy	WI	4295
Eastman	WI	410
Easton	WI	1085
Eau Claire	WI	67778
Eden	WI	862
Edgar	WI	1462
Edgerton	WI	5532
Edmund	WI	173
Egg Harbor	WI	202
El Paso	WI	680
Eland	WI	201
Elcho	WI	339
Elderon	WI	181
Eldorado	WI	1445
Eleva	WI	675
Elk Mound	WI	875
Elkhart Lake	WI	963
Elkhorn	WI	9895
Ellison Bay	WI	165
Ellsworth	WI	3197
Elm Grove	WI	6172
Elmwood	WI	808
Elmwood Park	WI	496
Elroy	WI	1372
Embarrass	WI	390
Emerald	WI	161
Endeavor	WI	460
Ephraim	WI	285
Ettrick	WI	518
Eureka	WI	220
Evansville	WI	5228
Evergreen	WI	3669
Exeland	WI	196
Fairchild	WI	563
Fairwater	WI	367
Fall Creek	WI	1315
Fall River	WI	1682
Fennimore	WI	2488
Fenwood	WI	152
Ferryville	WI	180
Fitchburg	WI	27996
Florence	WI	592
Fond du Lac	WI	42933
Fontana	WI	1720
Fontana-on-Geneva Lake	WI	0
Footville	WI	804
Forest Junction	WI	616
Forestville	WI	411
Fort Atkinson	WI	12426
Fountain	WI	0
Fountain City	WI	848
Fox Crossing	WI	0
Fox Lake	WI	1478
Fox Point	WI	6755
Francis Creek	WI	653
Franklin	WI	36222
Franks Field	WI	154
Franksville	WI	1846
Frederic	WI	1105
Fredonia	WI	2222
Fremont	WI	665
French Island	WI	4207
Friendship	WI	670
Friesland	WI	354
Fulton	WI	0
Galesville	WI	1551
Gays Mills	WI	530
Genoa	WI	269
Genoa City	WI	3029
Germantown	WI	19993
Gibbsville	WI	512
Gillett	WI	1353
Gilman	WI	397
Gilmanton	WI	0
Glen Flora	WI	87
Glen Haven	WI	73
Glenbeulah	WI	459
Glendale	WI	12870
Glenmore	WI	1142
Glenwood	WI	0
Glenwood City	WI	1219
Glidden	WI	507
Goodman	WI	271
Gordon	WI	176
Gotham	WI	191
Grafton	WI	11527
Grand Marsh	WI	127
Grand View	WI	163
Granton	WI	348
Grantsburg	WI	1289
Gratiot	WI	237
Green Bay	WI	105207
Green Lake	WI	984
Green Valley	WI	133
Greenbush	WI	162
Greendale	WI	14333
Greenfield	WI	37349
Greenleaf	WI	607
Greenville	WI	0
Greenwood	WI	1013
Gresham	WI	572
Hager	WI	0
Hager City	WI	338
Hales Corners	WI	7759
Hammond	WI	1898
Hancock	WI	400
Hanover	WI	181
Harrison	WI	7302
Harrisville	WI	0
Hartford	WI	14355
Hartland	WI	9219
Hatfield	WI	141
Hatley	WI	605
Haugen	WI	286
Hawkins	WI	284
Hayward	WI	2296
Hazel Green	WI	1247
Hebron	WI	224
Helenville	WI	249
Herbster	WI	104
Hewitt	WI	815
Highland	WI	843
Hilbert	WI	1106
Hiles	WI	167
Hillsboro	WI	1420
Hingham	WI	886
Hixton	WI	426
Hobart	WI	8283
Holcombe	WI	267
Hollandale	WI	290
Holmen	WI	9651
Horicon	WI	3689
Hortonville	WI	2712
Houlton	WI	386
Howard	WI	19250
Howards Grove	WI	3271
Hudson	WI	13566
Humbird	WI	266
Hurley	WI	1493
Hustisford	WI	1100
Hustler	WI	192
Independence	WI	1341
Ingram	WI	74
Iola	WI	1273
Iron Belt	WI	173
Iron Ridge	WI	904
Iron River	WI	761
Ironton	WI	256
Ixonia	WI	1624
Jackson	WI	6859
Janesville	WI	64123
Jefferson	WI	7941
Jim Falls	WI	237
Joel	WI	958
Johnson Creek	WI	2913
Jolmaville	WI	0
Juda	WI	357
Jump River	WI	52
Junction	WI	0
Junction City	WI	431
Juneau	WI	2692
Kaukauna	WI	15854
Kekoskee	WI	159
Kellnersville	WI	321
Kendall	WI	476
Kennan	WI	130
Kenosha	WI	99858
Kenosha Streetcar	WI	5555
Keshena	WI	1262
Kewaskum	WI	4096
Kewaunee	WI	2876
Kiel	WI	3719
Kieler	WI	497
Kimberly	WI	6744
King	WI	1750
Kingston	WI	327
Knapp	WI	460
Knowlton	WI	120
Kohler	WI	2110
Krakow	WI	354
Kronenwetter	WI	7630
La Crosse	WI	52306
La Farge	WI	768
La Valle	WI	364
Lac du Flambeau	WI	1969
Lac La Belle	WI	295
Ladysmith	WI	3188
Lake Arrowhead	WI	0
Lake Camelot	WI	0
Lake Delton	WI	2967
Lake Geneva	WI	7778
Lake Hallie	WI	6535
Lake Ivanhoe	WI	0
Lake Koshkonong	WI	1204
Lake Lac La Belle	WI	860
Lake Lorraine	WI	0
Lake Mills	WI	5798
Lake Nebagamon	WI	1058
Lake Ripley	WI	1779
Lake Shangrila	WI	861
Lake Sherwood	WI	0
Lake Tomahawk	WI	228
Lake Wazeecha	WI	2651
Lake Wisconsin	WI	4189
Lake Wissota	WI	2738
Lakewood	WI	323
Lamartine	WI	1727
Lancaster	WI	3778
Lannon	WI	1086
Laona	WI	583
Lauderdale Lakes	WI	0
Lebanon	WI	204
Legend Lake	WI	1525
Lena	WI	548
Leopolis	WI	87
Lewis	WI	164
Liberty	WI	558
Lily Lake	WI	0
Lime Ridge	WI	165
Lincoln	WI	291
Linden	WI	538
Lisbon	WI	0
Little Chute	WI	11026
Little Round Lake	WI	1081
Little Sturgeon	WI	136
Livingston	WI	650
Lodi	WI	3052
Loganville	WI	309
Lohrville	WI	383
Lomira	WI	2384
Lone Rock	WI	852
Long Lake	WI	50
Lowell	WI	325
Loyal	WI	1239
Lublin	WI	116
Luck	WI	1071
Luxemburg	WI	2556
Lyndon Station	WI	480
Lynxville	WI	129
Lyons	WI	0
Madison	WI	280305
Maiden Rock	WI	119
Maine	WI	2364
Manawa	WI	1316
Manchester	WI	1020
Manitowoc	WI	33010
Maple Bluff	WI	1340
Maple Grove	WI	980
Marathon	WI	1524
Marengo	WI	111
Maribel	WI	344
Marinette	WI	10799
Marion	WI	1220
Markesan	WI	1417
Marquette	WI	148
Marshall	WI	3927
Marshfield	WI	18620
Mason	WI	92
Mattoon	WI	421
Mauston	WI	4374
Mayville	WI	4989
Mazomanie	WI	1697
McFarland	WI	8209
Medford	WI	4338
Meeme	WI	1538
Mellen	WI	700
Melrose	WI	493
Melvina	WI	104
Menasha	WI	17572
Menomonee Falls	WI	36119
Menomonie	WI	16305
Mequon	WI	23132
Mercer	WI	516
Merrill	WI	9233
Merrillan	WI	533
Merrimac	WI	440
Merton	WI	3575
Middle	WI	0
Middle Inlet	WI	827
Middle Village	WI	281
Middleton	WI	18979
Milford	WI	1116
Milladore	WI	275
Millston	WI	125
Milltown	WI	883
Milton	WI	5593
Milwaukee	WI	563531
Mindoro	WI	0
Mineral Point	WI	2494
Minocqua	WI	451
Minong	WI	505
Mishicot	WI	1407
Mission	WI	0
Mole Lake	WI	435
Mondovi	WI	2654
Monona	WI	8164
Monroe	WI	10796
Montana	WI	281
Montello	WI	1456
Montfort	WI	702
Monticello	WI	1227
Montreal	WI	783
Mosinee	WI	4030
Mount Calvary	WI	746
Mount Hope	WI	222
Mount Horeb	WI	7421
Mount Morris	WI	1085
Mount Pleasant	WI	26272
Mount Sterling	WI	207
Mountain	WI	363
Mukwonago	WI	7721
Muscoda	WI	1265
Muskego	WI	24755
Nashotah	WI	1393
Nashville	WI	1037
Navarino	WI	177
Necedah	WI	921
Neenah	WI	25792
Neillsville	WI	2409
Nekoosa	WI	2474
Nelson	WI	352
Nelsonville	WI	158
Neopit	WI	690
Neosho	WI	557
Neshkoro	WI	423
New Auburn	WI	571
New Berlin	WI	39825
New Glarus	WI	2172
New Holstein	WI	3216
New Lisbon	WI	2486
New London	WI	7172
New Munster	WI	0
New Odanah	WI	472
New Post	WI	305
New Richmond	WI	8821
Newald	WI	95
Newburg	WI	1233
Niagara	WI	1587
Nichols	WI	269
North Bay	WI	240
North Fond du Lac	WI	5004
North Freedom	WI	706
North Hudson	WI	3822
North La Crosse	WI	50470
North Lake	WI	0
North Prairie	WI	2158
Northport	WI	491
Norwalk	WI	638
Oak Creek	WI	35243
Oakdale	WI	290
Oakfield	WI	1073
Oconomowoc	WI	16360
Oconomowoc Lake	WI	612
Oconto	WI	4476
Oconto Falls	WI	2834
Odanah	WI	13
Ogdensburg	WI	183
Ogema	WI	186
Okauchee Lake	WI	4422
Oliver	WI	398
Omro	WI	3553
Onalaska	WI	18468
Oneida	WI	1210
Ontario	WI	553
Oostburg	WI	2964
Oregon	WI	10043
Orfordville	WI	1495
Osceola	WI	2511
Oshkosh	WI	66555
Osseo	WI	1703
Owen	WI	930
Oxford	WI	590
Paac Ciinak	WI	0
Packwaukee	WI	262
Paddock Lake	WI	3014
Palmyra	WI	1776
Pardeeville	WI	2086
Park Falls	WI	2334
Park Ridge	WI	504
Patch Grove	WI	195
Pell Lake	WI	3722
Pella	WI	185
Pembine	WI	193
Pence	WI	131
Pepin	WI	795
Peshtigo	WI	3430
Pewaukee	WI	8208
Phillips	WI	1388
Pigeon Falls	WI	415
Pine River	WI	147
Pittsfield	WI	2704
Pittsville	WI	849
Plain	WI	779
Plainfield	WI	834
Platteville	WI	12572
Pleasant Prairie	WI	20726
Plover	WI	12319
Plum	WI	0
Plum City	WI	578
Plymouth	WI	8505
Polonia	WI	526
Poplar	WI	600
Port Edwards	WI	1740
Port Washington	WI	11576
Port Wing	WI	164
Portage	WI	10382
Portland	WI	1065
Post Lake	WI	374
Potosi	WI	678
Potter	WI	251
Potter Lake	WI	1107
Pound	WI	373
Powers Lake	WI	1615
Poy Sippi	WI	371
Poynette	WI	2493
Prairie du Chien	WI	5757
Prairie du Sac	WI	4255
Prairie Farm	WI	447
Prentice	WI	627
Prescott	WI	4208
Princeton	WI	1185
Pulaski	WI	3550
Pulcifer	WI	134
Racine	WI	77742
Radisson	WI	242
Randolph	WI	1770
Random Lake	WI	1594
Raymond	WI	0
Readstown	WI	416
Redgranite	WI	2113
Reedsburg	WI	9548
Reedsville	WI	1175
Reeseville	WI	687
Reserve	WI	429
Rewey	WI	297
Rhinelander	WI	7526
Rib Lake	WI	894
Rib Mountain	WI	5651
Rice Lake	WI	8391
Richfield	WI	11530
Richland Center	WI	5013
Richmond	WI	3449
Ridgeland	WI	278
Ridgeway	WI	643
Rio	WI	1044
Ripon	WI	7700
River Falls	WI	15269
River Hills	WI	1607
Roberts	WI	1638
Rochester	WI	3765
Rock Falls	WI	0
Rock Springs	WI	362
Rockdale	WI	220
Rockland	WI	621
Rome	WI	2697
Rosendale	WI	1043
Rosholt	WI	493
Rothschild	WI	5329
Roxbury	WI	1897
Rubicon	WI	0
Rudolph	WI	432
Rutland	WI	2060
Saint Cloud	WI	477
Saint Croix Falls	WI	2133
Saint Francis	WI	9365
Saint Joseph	WI	503
Saint Nazianz	WI	783
Saint Peter	WI	1489
Salem	WI	11416
Salem Lakes	WI	0
Sand Pillow	WI	0
Sandy Hook	WI	309
Sauk	WI	0
Sauk City	WI	3489
Saukville	WI	4463
Saxeville	WI	973
Saxon	WI	90
Sayner	WI	207
Scandinavia	WI	363
Schofield	WI	2203
Seneca	WI	0
Sextonville	WI	551
Seymour	WI	3440
Sharon	WI	1586
Shawano	WI	9128
Sheboygan	WI	48797
Sheboygan Falls	WI	7840
Sheldon	WI	224
Shell Lake	WI	1315
Sherry	WI	800
Sherwood	WI	2865
Shiocton	WI	921
Shopiere	WI	0
Shorewood	WI	13311
Shorewood Hills	WI	2037
Shullsburg	WI	1210
Silver Lake	WI	2480
Siren	WI	778
Sister Bay	WI	911
Slinger	WI	5208
Sobieski	WI	259
Soldiers Grove	WI	560
Solon Springs	WI	602
Somers	WI	9454
Somerset	WI	2693
South Milwaukee	WI	21233
South Wayne	WI	479
Sparta	WI	9679
Spencer	WI	1921
Spooner	WI	2586
Spring Green	WI	1648
Spring Valley	WI	1342
Springbrook	WI	0
Springfield	WI	158
St. Cloud	WI	0
St. Croix Falls	WI	0
St. Francis	WI	0
St. Joseph	WI	0
St. Nazianz	WI	0
St. Peter	WI	0
Stanley	WI	3569
Star Prairie	WI	569
Stetsonville	WI	526
Steuben	WI	129
Stevens Point	WI	26604
Stockbridge	WI	632
Stockholm	WI	66
Stoddard	WI	815
Stone Lake	WI	178
Stoughton	WI	13067
Stratford	WI	1577
Strum	WI	1125
Sturgeon Bay	WI	8956
Sturtevant	WI	6960
Suamico	WI	12187
Sullivan	WI	671
Summit	WI	0
Summit Lake	WI	144
Sun Prairie	WI	32365
Superior	WI	26579
Superior Village	WI	558
Suring	WI	527
Sussex	WI	10753
Sylvan	WI	542
Tainter Lake	WI	2242
Taycheedah	WI	704
Taylor	WI	472
Tennyson	WI	350
Theresa	WI	1213
Thiensville	WI	3174
Thornton	WI	65
Thorp	WI	1624
Three Lakes	WI	605
Tichigan	WI	5133
Tigerton	WI	721
Tilleda	WI	91
Tomah	WI	9357
Tomahawk	WI	3223
Tony	WI	107
Townsend	WI	146
Trego	WI	227
Trempealeau	WI	1615
Tunnel	WI	0
Tunnel City	WI	106
Turtle Lake	WI	1033
Tustin	WI	117
Twin Lakes	WI	6094
Two Rivers	WI	11331
Union Center	WI	195
Union Grove	WI	4891
Unity	WI	342
Valders	WI	940
Van Dyne	WI	279
Vermont	WI	864
Vernon	WI	0
Verona	WI	12540
Vesper	WI	559
Viola	WI	676
Viroqua	WI	4362
Wabeno	WI	575
Waldo	WI	496
Wales	WI	2573
Walworth	WI	2838
Warrens	WI	352
Washburn	WI	2055
Washington	WI	833
Waterford	WI	5358
Waterloo	WI	3343
Watertown	WI	23819
Waubeka	WI	657
Waukau	WI	255
Waukesha	WI	71970
Waumandee	WI	68
Waunakee	WI	13311
Waupaca	WI	6014
Waupun	WI	11343
Wausau	WI	39094
Wausaukee	WI	568
Wautoma	WI	2136
Wauwatosa	WI	47614
Wauzeka	WI	727
Webster	WI	627
West Allis	WI	60620
West Baraboo	WI	1439
West Bend	WI	31695
West Milwaukee	WI	4212
West Salem	WI	5014
Westboro	WI	190
Westby	WI	2263
Westfield	WI	1226
Weston	WI	15069
Weyauwega	WI	1866
Weyerhaeuser	WI	224
Wheeler	WI	335
White Lake	WI	339
Whitefish Bay	WI	14110
Whitehall	WI	1568
Whitelaw	WI	744
Whitewater	WI	14692
Whiting	WI	1727
Whittlesey	WI	105
Wild Rose	WI	699
Williams Bay	WI	2600
Wilmot	WI	442
Wilson	WI	186
Wilton	WI	506
Winchester	WI	671
Wind Lake	WI	5342
Wind Point	WI	1710
Windsor	WI	3573
Winneconne	WI	2445
Winter	WI	299
Wiota	WI	0
Wisconsin Dells	WI	2705
Wisconsin Rapids	WI	17897
Withee	WI	476
Wittenberg	WI	1022
Wonewoc	WI	796
Woodford	WI	69
Woodman	WI	130
Woodruff	WI	966
Woodville	WI	1339
Wrightstown	WI	3325
Wyalusing	WI	342
Wyeville	WI	147
Wyocena	WI	744
Yorkville	WI	0
Yuba	WI	72
Zoar	WI	98
Accoville	WV	574
Addison (Webster Springs)	WV	0
Adrian	WV	0
Albright	WV	304
Alderson	WV	1182
Alum Creek	WV	1749
Amherstdale	WV	350
Anawalt	WV	208
Anmoore	WV	757
Ansted	WV	1397
Apple Grove	WV	204
Arbovale	WV	0
Arthurdale	WV	0
Athens	WV	951
Auburn	WV	93
Augusta	WV	5734
Aurora	WV	201
Bancroft	WV	592
Barboursville	WV	4069
Barrackville	WV	1321
Bartley	WV	224
Bartow	WV	111
Bath (Berkeley Springs)	WV	0
Baxter	WV	0
Bayard	WV	276
Beards Fork	WV	199
Beaver	WV	1308
Beckley	WV	17056
Beech Bottom	WV	500
Belington	WV	1933
Belle	WV	1211
Belmont	WV	901
Belva	WV	95
Benwood	WV	1361
Bergoo	WV	94
Berkeley Springs	WV	766
Berwind	WV	278
Bethany	WV	1029
Bethlehem	WV	2588
Beverly	WV	685
Big Chimney	WV	627
Big Creek	WV	237
Big Sandy	WV	168
Birch River	WV	107
Blacksville	WV	182
Blennerhassett	WV	3089
Bluefield	WV	10323
Bluewell	WV	2184
Boaz	WV	1297
Bolivar	WV	1060
Bolt	WV	548
Boomer	WV	615
Booth	WV	0
Bowden	WV	9
Bradley	WV	2040
Bradshaw	WV	307
Bramwell	WV	362
Brandonville	WV	103
Brandywine	WV	218
Brenton	WV	249
Bridgeport	WV	8359
Brookhaven	WV	5171
Bruceton Mills	WV	87
Bruno	WV	544
Brush Fork	WV	1197
Buckhannon	WV	5657
Bud	WV	487
Buffalo	WV	1253
Burlington	WV	182
Burnsville	WV	498
Cairo	WV	270
Camden on Gauley	WV	154
Camden-on-Gauley	WV	0
Cameron	WV	903
Capon Bridge	WV	362
Carolina	WV	411
Carpendale	WV	937
Cass	WV	52
Cassville	WV	701
Cedar Grove	WV	952
Century	WV	115
Ceredo	WV	1388
Chapmanville	WV	1205
Charles	WV	0
Charles Town	WV	5899
Charleston	WV	46838
Charlton Heights	WV	406
Chattaroy	WV	756
Chauncey	WV	283
Cheat Lake	WV	7988
Chelyan	WV	776
Chesapeake	WV	1502
Chester	WV	2498
Clarksburg	WV	16152
Clay	WV	467
Clearview	WV	553
Clendenin	WV	1187
Clifton	WV	0
Coal	WV	0
Coal City	WV	1815
Coal Fork	WV	1233
Coalton	WV	315
Colcord	WV	0
Colliers	WV	0
Comfort	WV	306
Corinne	WV	362
Cottageville	WV	0
Covel	WV	142
Cowen	WV	505
Crab Orchard	WV	2678
Craigsville	WV	2213
Crooked Creek	WV	0
Cross Lanes	WV	9995
Crum	WV	182
Crumpler	WV	204
Cucumber	WV	94
Culloden	WV	3061
Cunard	WV	0
Dailey	WV	114
Daniels	WV	1881
Danville	WV	655
Davis	WV	658
Davy	WV	385
Deep Water	WV	280
Delbarton	WV	540
Despard	WV	1004
Dixie	WV	291
Dorothy	WV	0
Dunbar	WV	7659
Dupont	WV	0
Durbin	WV	288
Earling	WV	0
East Bank	WV	932
East Dailey	WV	557
East View	WV	0
Eccles	WV	362
Eleanor	WV	1586
Elizabeth	WV	839
Elk Garden	WV	224
Elkins	WV	7226
Elkview	WV	1222
Ellenboro	WV	347
Enterprise	WV	961
Eskdale	WV	0
Fairlea	WV	1747
Fairmont	WV	18733
Fairview	WV	414
Falling Spring	WV	210
Falling Waters	WV	876
Falls View	WV	238
Farmington	WV	377
Fayetteville	WV	2892
Fenwick	WV	116
Flatwoods	WV	277
Flemington	WV	313
Follansbee	WV	2887
Fort Ashby	WV	1380
Fort Gay	WV	683
Frank	WV	90
Franklin	WV	677
Friendly	WV	129
Gallipolis Ferry	WV	817
Galloway	WV	143
Garten	WV	0
Gary	WV	889
Gassaway	WV	902
Gatewood	WV	0
Gauley Bridge	WV	595
Ghent	WV	457
Gilbert	WV	423
Gilbert Creek	WV	1090
Glasgow	WV	877
Glen Dale	WV	0
Glen Ferris	WV	203
Glen Fork	WV	487
Glen Jean	WV	210
Glen White	WV	266
Glendale	WV	1526
Glenville	WV	1543
Grafton	WV	5148
Grant	WV	0
Grant Town	WV	618
Grantsville	WV	548
Granville	WV	2554
Great Cacapon	WV	386
Green Bank	WV	143
Green Spring	WV	218
Greenview	WV	378
Greenville	WV	0
Gypsy	WV	328
Hambleton	WV	226
Hamlin	WV	1123
Handley	WV	341
Hansford	WV	0
Harman	WV	142
Harpers Ferry	WV	295
Harrisville	WV	1775
Hartford	WV	0
Hartford City	WV	598
Harts	WV	656
Hedgesville	WV	319
Helen	WV	219
Helvetia	WV	59
Henderson	WV	268
Hendricks	WV	266
Henlawson	WV	442
Hepzibah	WV	566
Hico	WV	272
Hillsboro	WV	250
Hilltop	WV	624
Hinkleville	WV	0
Hinton	WV	2528
Holden	WV	876
Hollygrove	WV	0
Hometown	WV	668
Hooverson Heights	WV	2590
Hundred	WV	286
Huntersville	WV	73
Huntington	WV	48638
Hurricane	WV	6493
Huttonsville	WV	219
Iaeger	WV	275
Idamay	WV	611
Institute	WV	0
Inwood	WV	2954
Itmann	WV	293
Jacksonburg	WV	182
Jane Lew	WV	409
Jefferson	WV	676
Junior	WV	503
Justice	WV	412
Justice Addition	WV	0
Kanawha	WV	0
Kenova	WV	3083
Kermit	WV	381
Keyser	WV	5248
Keystone	WV	390
Kimball	WV	178
Kimberly	WV	287
Kincaid	WV	260
Kingwood	WV	2959
Kistler	WV	528
Kopperston	WV	616
Lashmeet	WV	479
Lavalette	WV	1073
Leon	WV	157
Lesage	WV	1358
Lester	WV	328
Lewisburg	WV	3949
Littleton	WV	198
Logan	WV	1649
Lost Creek	WV	478
Lubeck	WV	1311
Lumberport	WV	863
Mabscott	WV	1372
MacArthur	WV	1500
Madison	WV	2929
Malden	WV	0
Mallory	WV	1654
Man	WV	704
Mannington	WV	2077
Marlinton	WV	1029
Marmet	WV	1450
Martinsburg	WV	17700
Maryland Junction	WV	954
Mason	WV	942
Masontown	WV	546
Matewan	WV	467
Matheny	WV	531
Matoaka	WV	220
Maybeury	WV	234
McConnell	WV	514
McMechen	WV	1842
Meadow Bridge	WV	362
Middlebourne	WV	790
Middleway	WV	441
Mill Creek	WV	706
Milton	WV	2637
Minden	WV	250
Mineral Wells	WV	1950
Mineralwells	WV	0
Mitchell Heights	WV	308
Monaville	WV	309
Monongah	WV	1091
Montcalm	WV	726
Montgomery	WV	1596
Montrose	WV	156
Moorefield	WV	2482
Morgantown	WV	30708
Moundsville	WV	8710
Mount Carbon	WV	428
Mount Gay-Shamrock	WV	1779
Mount Hope	WV	1377
Mullens	WV	1464
Neibert	WV	183
Nettie	WV	568
New Cumberland	WV	1063
New Haven	WV	1532
New Martinsville	WV	5218
New Richmond	WV	238
Newark	WV	0
Newburg	WV	321
Newell	WV	1376
Nitro	WV	6763
North Hills	WV	829
Northfork	WV	384
Norton	WV	281
Nutter Fort	WV	1575
Oak Hill	WV	8140
Oakvale	WV	120
Oceana	WV	1302
Omar	WV	552
Osage	WV	163
Paden	WV	0
Paden City	WV	2506
Page	WV	224
Pageton	WV	187
Parcoal	WV	0
Parkersburg	WV	30991
Parsons	WV	1431
Paw Paw	WV	508
Pax	WV	164
Pea Ridge	WV	6650
Peach Creek	WV	0
Pennsboro	WV	1080
Pentress	WV	175
Petersburg	WV	2520
Peterstown	WV	645
Philippi	WV	3256
Pickens	WV	66
Piedmont	WV	925
Pinch	WV	3262
Pine Grove	WV	520
Pineville	WV	628
Piney View	WV	989
Pleasant Valley	WV	3196
Poca	WV	989
Point Pleasant	WV	4276
Powellton	WV	619
Pratt	WV	586
Prichard	WV	527
Prince	WV	116
Princeton	WV	6035
Prosperity	WV	1498
Pullman	WV	148
Quinwood	WV	288
Rachel	WV	248
Racine	WV	256
Rainelle	WV	1481
Raleigh	WV	0
Rand	WV	1631
Ranson	WV	4941
Ravenswood	WV	3843
Raymond	WV	0
Raysal	WV	465
Reader	WV	397
Red Jacket	WV	581
Reedsville	WV	601
Reedy	WV	175
Reynoldsville	WV	0
Rhodell	WV	170
Richwood	WV	1980
Ridgeley	WV	643
Ripley	WV	3255
Rivesville	WV	944
Robinette	WV	663
Rock Cave	WV	0
Roderfield	WV	188
Romney	WV	1773
Ronceverte	WV	1752
Rossmore	WV	301
Rowlesburg	WV	581
Rupert	WV	932
Saint Albans	WV	11044
Saint Marys	WV	1860
Salem	WV	1551
Salt Rock	WV	388
Sand Fork	WV	156
Sarah Ann	WV	345
Scarbro	WV	486
Shady Spring	WV	2998
Shannondale	WV	3358
Shenandoah Junction	WV	703
Shepherdstown	WV	2079
Shinnston	WV	2171
Shrewsbury	WV	652
Sissonville	WV	4028
Sistersville	WV	1366
Smithers	WV	790
Smithfield	WV	159
Sophia	WV	1318
South Charleston	WV	13045
Spelter	WV	346
Spencer	WV	2195
Sprague	WV	0
Springfield	WV	477
St. Albans	WV	0
St. George	WV	0
St. Marys	WV	0
Stanaford	WV	1350
Star	WV	0
Star City	WV	2014
Stollings	WV	316
Stonewood	WV	1766
Summersville	WV	3478
Sutton	WV	984
Switzer	WV	595
Sylvester	WV	153
Teays Valley	WV	13175
Terra Alta	WV	1493
Thomas	WV	565
Thurmond	WV	5
Tioga	WV	98
Tornado	WV	1081
Triadelphia	WV	772
Tunnelton	WV	299
Twilight	WV	90
Union	WV	559
Valley Bend	WV	485
Valley Grove	WV	369
Valley Head	WV	267
Van	WV	211
Verdunville	WV	687
Vienna	WV	10573
Vivian	WV	82
Wallace	WV	0
War	WV	775
Wardensville	WV	274
Washington	WV	1175
Waverly	WV	395
Wayne	WV	1382
Webster Springs	WV	1009
Weirton	WV	19175
Weirton Heights	WV	19450
Welch	WV	1973
Wellsburg	WV	2704
West Dunbar	WV	0
West Hamlin	WV	762
West Liberty	WV	1590
West Logan	WV	400
West Milford	WV	619
West Union	WV	831
Weston	WV	4082
Westover	WV	4223
Wheeling	WV	27648
White Hall	WV	663
White Sulphur Springs	WV	2438
Whitesville	WV	475
Whitmer	WV	106
Wiley Ford	WV	1026
Williamson	WV	3003
Williamstown	WV	2965
Windsor Heights	WV	402
Winfield	WV	2354
Wolf Summit	WV	272
Womelsdorf (Coalton)	WV	0
Worthington	WV	160
Afton	WY	1972
Airport Road	WY	304
Albany	WY	55
Albin	WY	190
Alcova	WY	76
Alpine	WY	850
Alpine Northeast	WY	196
Alpine Northwest	WY	244
Alta	WY	394
Antelope Hills	WY	97
Antelope Valley-Crestview	WY	1658
Arapahoe	WY	1656
Arlington	WY	25
Arrowhead Springs	WY	63
Arvada	WY	43
Atlantic	WY	0
Atlantic City	WY	37
Auburn	WY	328
Baggs	WY	431
Bairoil	WY	105
Bar Nunn	WY	2820
Basin	WY	1305
Bear River	WY	518
Bedford	WY	201
Bessemer Bend	WY	199
Beulah	WY	73
Big Horn	WY	490
Big Piney	WY	531
Bondurant	WY	93
Boulder	WY	170
Boulder Flats	WY	408
Brookhurst	WY	185
Buffalo	WY	4632
Burlington	WY	341
Burns	WY	304
Byron	WY	617
Calpet	WY	7
Carpenter	WY	94
Carter	WY	10
Casper	WY	60285
Casper Mountain	WY	401
Centennial	WY	270
Cheyenne	WY	65132
Chugcreek	WY	156
Chugwater	WY	216
Clearmont	WY	140
Clearview Acres	WY	795
Cody	WY	9792
Cokeville	WY	541
Cora	WY	142
Cowley	WY	735
Crowheart	WY	141
Daniel	WY	150
Dayton	WY	804
Deaver	WY	186
Diamondville	WY	738
Dixon	WY	95
Douglas	WY	6531
Dubois	WY	987
East Thermopolis	WY	248
Eden	WY	281
Edgerton	WY	201
El Rancho	WY	0
Elk Mountain	WY	196
Encampment	WY	438
Esterbrook	WY	52
Ethete	WY	1553
Etna	WY	164
Evanston	WY	12133
Evansville	WY	2931
Fairview	WY	275
Farson	WY	313
Fontenelle	WY	13
Fort Bridger	WY	345
Fort Laramie	WY	224
Fort Washakie	WY	1759
Fox Farm-College	WY	3647
Fox Park	WY	0
Foxpark	WY	22
Frannie	WY	163
Freedom	WY	0
Garland	WY	115
Gillette	WY	32649
Glendo	WY	200
Glenrock	WY	2598
Granger	WY	138
Green River	WY	12465
Greybull	WY	1879
Grover	WY	147
Guernsey	WY	1195
Hanna	WY	814
Hartrandt	WY	693
Hartville	WY	62
Hawk Springs	WY	45
Hill View Heights	WY	170
Hillsdale	WY	47
Hoback	WY	1176
Homa Hills	WY	278
Hudson	WY	456
Hulett	WY	409
Huntley	WY	30
Hyattville	WY	75
Jackson	WY	10523
James	WY	0
James Town	WY	536
Jeffrey	WY	0
Jeffrey City	WY	58
Johnstown	WY	242
Kaycee	WY	261
Kelly	WY	138
Kemmerer	WY	2739
Kirby	WY	92
La Barge	WY	553
La Grange	WY	455
LaGrange	WY	0
Lakeview North	WY	84
Lance Creek	WY	43
Lander	WY	7686
Laramie	WY	32158
Lingle	WY	462
Little America	WY	68
Lonetree	WY	49
Lost Springs	WY	4
Lovell	WY	2422
Lucerne	WY	535
Lusk	WY	1628
Lyman	WY	2074
Mammoth	WY	263
Manderson	WY	117
Manville	WY	96
Marbleton	WY	1090
McKinnon	WY	60
Meadow Acres	WY	198
Meadow Lark Lake	WY	8
Medicine Bow	WY	270
Meeteetse	WY	326
Midwest	WY	410
Mills	WY	3785
Moorcroft	WY	1062
Moose Wilson Road	WY	1821
Mountain View	WY	1294
Newcastle	WY	3534
Nordic	WY	0
North Rock Springs	WY	2207
Oakley	WY	49
Opal	WY	100
Orin	WY	46
Osage	WY	208
Osmond	WY	397
Owl Creek	WY	5
Parkman	WY	151
Pavillion	WY	238
Pine Bluffs	WY	1146
Pine Haven	WY	519
Pinedale	WY	1923
Point of Rocks	WY	3
Powder Horn	WY	0
Powder River	WY	44
Powell	WY	6462
Purple Sage	WY	535
Rafter J Ranch	WY	1075
Ralston	WY	280
Ranchester	WY	940
Ranchettes	WY	5798
Rawlins	WY	9040
Red Butte	WY	449
Reliance	WY	714
Riverside	WY	53
Riverton	WY	10873
Robertson	WY	97
Rock River	WY	244
Rock Springs	WY	23962
Rolling Hills	WY	442
Ryan Park	WY	38
Saratoga	WY	1677
Shell	WY	83
Sheridan	WY	17873
Shoshoni	WY	648
Sinclair	WY	413
Slater	WY	80
Sleepy Hollow	WY	1308
Smoot	WY	195
South Flat	WY	383
South Greeley	WY	4217
South Park	WY	1731
Star Valley Ranch	WY	1548
Story	WY	828
Sundance	WY	1272
Superior	WY	229
Sweeney Ranch	WY	17
Table Rock	WY	0
Taylor	WY	90
Ten Sleep	WY	254
Teton	WY	0
Teton Village	WY	330
Thayne	WY	363
Thermopolis	WY	2974
Torrington	WY	6669
Turnerville	WY	192
Upton	WY	1109
Urie	WY	262
Van Tassell	WY	15
Veteran	WY	23
Vista West	WY	951
Wamsutter	WY	493
Warren AFB	WY	0
Washakie Ten	WY	619
Washam	WY	51
West River	WY	329
Westview Circle	WY	52
Wheatland	WY	3659
Whiting	WY	83
Wilson	WY	1482
Winchester	WY	61
Woods Landing-Jelm	WY	97
Worland	WY	5372
Wright	WY	1862
Y-O Ranch	WY	195
Yoder	WY	159`;
