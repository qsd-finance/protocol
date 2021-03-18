pragma solidity >=0.7.0 <0.8.0;

interface IERC20 {
  function totalSupply() external view returns (uint256);
  function balanceOf(address who) external view returns (uint256);
  function transfer(address to, uint256 value) external returns (bool);
  function allowance(address owner, address spender) external view returns (uint256);
  function transferFrom(address from, address to, uint256 value) external returns (bool);
  function approve(address spender, uint256 value) external returns (bool);
  
  event Approval(address indexed owner, address indexed spender, uint256 value);  
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract Claims {
    
    address qsdAddress;
    address qsdgAddress;
    IERC20 qsdToken;
    IERC20 qsdgToken;
    address treasury;
    
    mapping (address => uint256) private qsdBalances;
    mapping (address => uint256) private qsdgBalances;

    constructor(address _treasury, address _qsdAddress, address _qsdgAddress)  {
        treasury = _treasury;
        
        qsdAddress = _qsdAddress;
        qsdToken = IERC20(qsdAddress);
        qsdgAddress = _qsdgAddress;
        qsdgToken = IERC20(qsdgAddress);

        // Snapshot balances below:
        qsdBalances[0xD6F82502F20647dd8d78DFFb6AD7F8D8193d5e29] = 73329453483199450578944;
        qsdgBalances[0xD6F82502F20647dd8d78DFFb6AD7F8D8193d5e29] = 1443307653168262807552;

        qsdBalances[0xa9ADfC9f69317Ef5e76CE5fb2f0EEFc4022859fd] = 16962500534342299648;
        qsdgBalances[0xa9ADfC9f69317Ef5e76CE5fb2f0EEFc4022859fd] = 0;

        qsdBalances[0x2A5Ba2F22966D34cC4faBF33FAFa69068B6b5701] = 0;
        qsdgBalances[0x2A5Ba2F22966D34cC4faBF33FAFa69068B6b5701] = 299738258559089770496;

        qsdBalances[0x5BfcE71a1909b4525156290A8Fa61Af0f723aB4b] = 76208744088614039715840;
        qsdgBalances[0x5BfcE71a1909b4525156290A8Fa61Af0f723aB4b] = 697471411205787353088;

        qsdBalances[0xBc6D94EEE89A18AAe9a39542f7E2f2dfb3FecF5f] = 11506095087757853458432;
        qsdgBalances[0xBc6D94EEE89A18AAe9a39542f7E2f2dfb3FecF5f] = 225941732670510923776;

        qsdBalances[0x10340db8bD18401B65D1178Ba45d7CE3c66aA6B7] = 6226818639330509062144;
        qsdgBalances[0x10340db8bD18401B65D1178Ba45d7CE3c66aA6B7] = 106343607464198569984;

        qsdBalances[0x082E9C0Bd157d085851Dcb439Df845eA652cb823] = 882919683866060259328;
        qsdgBalances[0x082E9C0Bd157d085851Dcb439Df845eA652cb823] = 13683644070266867712;

        qsdBalances[0xB49Ba65CE96ab19b49Da09BfA124279daeb1D33B] = 4819113444626799788032;
        qsdgBalances[0xB49Ba65CE96ab19b49Da09BfA124279daeb1D33B] = 0;

        qsdBalances[0x2BB4FE21E2faf25A8f6E8c369C560A5B8a60879E] = 167210040487677165568;
        qsdgBalances[0x2BB4FE21E2faf25A8f6E8c369C560A5B8a60879E] = 5571905901088275456;

        qsdBalances[0xeaa40F6B29CE35d8F53f6bF9b2A7397E3D8475Af] = 7;
        qsdgBalances[0xeaa40F6B29CE35d8F53f6bF9b2A7397E3D8475Af] = 0;

        qsdBalances[0xEb90439080086b65AF16774b910274208c4dF013] = 41171982851331558735872;
        qsdgBalances[0xEb90439080086b65AF16774b910274208c4dF013] = 318977084439211343872;

        qsdBalances[0xF5C8bCCF681276f69011AC6FeF2070A38FA175a7] = 48370833374439931904;
        qsdgBalances[0xF5C8bCCF681276f69011AC6FeF2070A38FA175a7] = 24251297044710301696;

        qsdBalances[0x7230b49CD39AE09aEB9b61b575250b647FeA5721] = 241461050697946208;
        qsdgBalances[0x7230b49CD39AE09aEB9b61b575250b647FeA5721] = 0;

        qsdBalances[0x8d4CA87F859D9581954586e671a66B2636fD7Bdd] = 37523087085404067725312;
        qsdgBalances[0x8d4CA87F859D9581954586e671a66B2636fD7Bdd] = 1088986170079327158272;

        qsdBalances[0x525087F76E899aCc5317d5d2C338cb3743196fAb] = 2318966230956216418304;
        qsdgBalances[0x525087F76E899aCc5317d5d2C338cb3743196fAb] = 24512098295926231040;

        qsdBalances[0xbcb8171050Fe9c08066a5008f5Da484cC5E8e3FF] = 10515363434087787266048;
        qsdgBalances[0xbcb8171050Fe9c08066a5008f5Da484cC5E8e3FF] = 179698975322689601536;

        qsdBalances[0x245F3f8D05aeC1aF25b84EaA5FcBf03b50c6A9a4] = 643376791060227072;
        qsdgBalances[0x245F3f8D05aeC1aF25b84EaA5FcBf03b50c6A9a4] = 0;

        qsdBalances[0xD028BaBBdC15949aAA35587f95F9E96c7d49417D] = 23;
        qsdgBalances[0xD028BaBBdC15949aAA35587f95F9E96c7d49417D] = 0;

        qsdBalances[0xc7255530b38b7a560ea1f02dD19bFaA1415A3e94] = 1523760565332296335360;
        qsdgBalances[0xc7255530b38b7a560ea1f02dD19bFaA1415A3e94] = 24395561125962096640;

        qsdBalances[0x9503f753692df9AfFa5B15efe56977c7186738F5] = 4000287919005954998272;
        qsdgBalances[0x9503f753692df9AfFa5B15efe56977c7186738F5] = 40509638809953222656;

        qsdBalances[0x82e1dE949DF695AAA8053f53008320F8EAd52814] = 55780647826147206234112;
        qsdgBalances[0x82e1dE949DF695AAA8053f53008320F8EAd52814] = 1201343162870079422464;

        qsdBalances[0xB006be3e08b54DBdA89725a313803f4B1875259f] = 48465406573780980989952;
        qsdgBalances[0xB006be3e08b54DBdA89725a313803f4B1875259f] = 819632410640593715200;

        qsdBalances[0x2E009154122D5d56D3edE29b968E5Fdb8Fede051] = 6987740772718365114368;
        qsdgBalances[0x2E009154122D5d56D3edE29b968E5Fdb8Fede051] = 0;

        qsdBalances[0x3133d8F064B45Fe2D1EDC21c3fBf5543aCc9c0d0] = 216120184735893487616;
        qsdgBalances[0x3133d8F064B45Fe2D1EDC21c3fBf5543aCc9c0d0] = 3535092211204555776;

        qsdBalances[0xdBba5c9AB0F3Ac341Fc741b053678Ade367236e6] = 32141278438218958635008;
        qsdgBalances[0xdBba5c9AB0F3Ac341Fc741b053678Ade367236e6] = 809394100051331645440;

        qsdBalances[0x36b4861f493a95a75C99983B3929AF8fC0E8C5b9] = 607638473081789696;
        qsdgBalances[0x36b4861f493a95a75C99983B3929AF8fC0E8C5b9] = 0;

        qsdBalances[0x888851dC68c2f675c48B9967dd234dbe0e955fB7] = 13021194717385965174784;
        qsdgBalances[0x888851dC68c2f675c48B9967dd234dbe0e955fB7] = 211895366236569600000;

        qsdBalances[0xD11Eb5Db7cFbB9ECae4B62E71Ec0A461F6baF669] = 69;
        qsdgBalances[0xD11Eb5Db7cFbB9ECae4B62E71Ec0A461F6baF669] = 0;

        qsdBalances[0xAbd252CfbaE138043e4fB5E667B489710964D572] = 933651636062542102528;
        qsdgBalances[0xAbd252CfbaE138043e4fB5E667B489710964D572] = 13829906851476764672;

        qsdBalances[0x6B67623ff56c10d9dcFc2152425f90285fC74DDD] = 2027443006587180679168;
        qsdgBalances[0x6B67623ff56c10d9dcFc2152425f90285fC74DDD] = 4098991228434835456;

        qsdBalances[0x504C11bDBE6E29b46E23e9A15d9c8d2e2e795709] = 2251313146393121280;
        qsdgBalances[0x504C11bDBE6E29b46E23e9A15d9c8d2e2e795709] = 0;

        qsdBalances[0x247C08e7f043B960457676516A3258484aD8e7Bb] = 99797699036097099595776;
        qsdgBalances[0x247C08e7f043B960457676516A3258484aD8e7Bb] = 1818989;

        qsdBalances[0x7a03b2e8ACe63164896717C1b22647aA450954A7] = 4068786728822305718272;
        qsdgBalances[0x7a03b2e8ACe63164896717C1b22647aA450954A7] = 0;

        qsdBalances[0x81725dFB3F92f8301DDADe77E29536605e8Df162] = 60095412713116252766208;
        qsdgBalances[0x81725dFB3F92f8301DDADe77E29536605e8Df162] = 1182710905347271819264;

        qsdBalances[0x98E9dB4FEafc72D177C77AED8ee97F4DF71EA681] = 34460086367481359237120;
        qsdgBalances[0x98E9dB4FEafc72D177C77AED8ee97F4DF71EA681] = 0;

        qsdBalances[0xD887758a36bbf3c44ba3F1ffA0d8Ff8D536Cc129] = 77815456121115230208;
        qsdgBalances[0xD887758a36bbf3c44ba3F1ffA0d8Ff8D536Cc129] = 0;

        qsdBalances[0x6127cb39Ac8e6066C469aCE0edcC3506feaAbF94] = 3093185168521717760;
        qsdgBalances[0x6127cb39Ac8e6066C469aCE0edcC3506feaAbF94] = 0;

        qsdBalances[0xaa0a2a0821094494FBeBF72e1a01572B99D364d6] = 1445834974860779192320;
        qsdgBalances[0xaa0a2a0821094494FBeBF72e1a01572B99D364d6] = 16403954786676561920;

        qsdBalances[0x267FBb02a1AD26d59A5C95430ae04089D1eA9aA8] = 6513463770933834547200;
        qsdgBalances[0x267FBb02a1AD26d59A5C95430ae04089D1eA9aA8] = 80321631373633372160;

        qsdBalances[0x4315Ed306e03192867b1799E4C0895A4cD9D82D4] = 2544714162876454010880;
        qsdgBalances[0x4315Ed306e03192867b1799E4C0895A4cD9D82D4] = 28781626755450118144;

        qsdBalances[0x3BfCD762365960738d60cCC3615A24Ba99e3bE36] = 593127406462326272;
        qsdgBalances[0x3BfCD762365960738d60cCC3615A24Ba99e3bE36] = 0;

        qsdBalances[0x72B92dce4c6276A1FF2f7278F1FE96e9F2BfC564] = 16;
        qsdgBalances[0x72B92dce4c6276A1FF2f7278F1FE96e9F2BfC564] = 0;

        qsdBalances[0x5aB60b1c7d78014c4490D5e78BA551D51729E1De] = 79806105669737593700352;
        qsdgBalances[0x5aB60b1c7d78014c4490D5e78BA551D51729E1De] = 1248747880557542375424;

        qsdBalances[0x4BB0Cc5dFF52f56DBec078d6E7aF7Ff2991c45F8] = 0;
        qsdgBalances[0x4BB0Cc5dFF52f56DBec078d6E7aF7Ff2991c45F8] = 4029792341861910016;

        qsdBalances[0xdA85D449a9837Bb7E790322df0675C8877eb3183] = 1256000000000000000000;
        qsdgBalances[0xdA85D449a9837Bb7E790322df0675C8877eb3183] = 0;

        qsdBalances[0x805AdaDD964775dC22BB2F3F55685b163dA45f4D] = 1045725983004432662528;
        qsdgBalances[0x805AdaDD964775dC22BB2F3F55685b163dA45f4D] = 15381166820337510400;

        qsdBalances[0x2A17E8e8D09Ea5Bd7dc66854FBa3556941b59f0a] = 23563502918867001278464;
        qsdgBalances[0x2A17E8e8D09Ea5Bd7dc66854FBa3556941b59f0a] = 491445069669330780160;

        qsdBalances[0x2d7265834D2Fb595Fd93cd73536E448d03b5e258] = 2695054317644102500352;
        qsdgBalances[0x2d7265834D2Fb595Fd93cd73536E448d03b5e258] = 39921046280040439808;

        qsdBalances[0x3B061f47fd08C7a8aF6419BB88733A4ED8eA0BFc] = 0;
        qsdgBalances[0x3B061f47fd08C7a8aF6419BB88733A4ED8eA0BFc] = 26056346312013049856;

        qsdBalances[0xC3373905F94e16035f7E01fD5178586e5F478C81] = 22613388756220157952;
        qsdgBalances[0xC3373905F94e16035f7E01fD5178586e5F478C81] = 0;

        qsdBalances[0xc8E68D674Df0Eab152926C4F0EE7D0ac0745c715] = 14;
        qsdgBalances[0xc8E68D674Df0Eab152926C4F0EE7D0ac0745c715] = 0;

        qsdBalances[0xe08D4F39B64597491bF3cDDDc2DD7Bd72e04847B] = 1;
        qsdgBalances[0xe08D4F39B64597491bF3cDDDc2DD7Bd72e04847B] = 0;

        qsdBalances[0xcaFe88440d319bF7c9d8dF4BCE9621D56f04E387] = 197506728873560064;
        qsdgBalances[0xcaFe88440d319bF7c9d8dF4BCE9621D56f04E387] = 0;

        qsdBalances[0x766F914f9301E35E31E090a8a39b5Baf7B40E5Ad] = 5179330299478488064;
        qsdgBalances[0x766F914f9301E35E31E090a8a39b5Baf7B40E5Ad] = 0;

        qsdBalances[0xd8D3d8ab22E30c5402AB2A2E216a4A53F4e09e9E] = 1474475869199306588160;
        qsdgBalances[0xd8D3d8ab22E30c5402AB2A2E216a4A53F4e09e9E] = 22351279140707561472;

        qsdBalances[0xfe703B6481db5BE11A4cDF2b48b38a2EF84990Fd] = 10230567790221043712;
        qsdgBalances[0xfe703B6481db5BE11A4cDF2b48b38a2EF84990Fd] = 0;

        qsdBalances[0xbA47cac45Ac62c5ffCE4f83Cf8e13013851A6b33] = 12808068377633271840768;
        qsdgBalances[0xbA47cac45Ac62c5ffCE4f83Cf8e13013851A6b33] = 0;

        qsdBalances[0xdbEaE6158d812b771da0ACc5Da2c8c979661f63a] = 3;
        qsdgBalances[0xdbEaE6158d812b771da0ACc5Da2c8c979661f63a] = 0;

        qsdBalances[0x64C8Fe5039CEAFEE35bFfBC675015dBd1765D534] = 0;
        qsdgBalances[0x64C8Fe5039CEAFEE35bFfBC675015dBd1765D534] = 20172467810780401664;

        qsdBalances[0x7589319ED0fD750017159fb4E4d96C63966173C1] = 5024405542546332;
        qsdgBalances[0x7589319ED0fD750017159fb4E4d96C63966173C1] = 0;

        qsdBalances[0x1E225a3f2626ec52BC5bc3C27F36A1a9F28e84f4] = 9932622796015525691392;
        qsdgBalances[0x1E225a3f2626ec52BC5bc3C27F36A1a9F28e84f4] = 168321010802135105536;

        qsdBalances[0x907438a78302035E0fd11fB88204a9E1B57cCC68] = 986225986009559072768;
        qsdgBalances[0x907438a78302035E0fd11fB88204a9E1B57cCC68] = 14207516406475999232;

        qsdBalances[0x199376b1FF0CeC967E41f899339d001119C5317F] = 89999999999999995805696;
        qsdgBalances[0x199376b1FF0CeC967E41f899339d001119C5317F] = 0;

        qsdBalances[0x439F6D045d30d667C63fc1C67854A50cA3A8b91B] = 260452252528629841920;
        qsdgBalances[0x439F6D045d30d667C63fc1C67854A50cA3A8b91B] = 2176684816453460736;

        qsdBalances[0x08Fc3eFd10a7003729FE5D69521757472511b1A0] = 16260240264991906725888;
        qsdgBalances[0x08Fc3eFd10a7003729FE5D69521757472511b1A0] = 309037735222108749824;

        qsdBalances[0xa2040D6b10595EcBa2F751737b4A931A868f0655] = 19084900883361769193472;
        qsdgBalances[0xa2040D6b10595EcBa2F751737b4A931A868f0655] = 365593031328713146368;

        qsdBalances[0x63eAf0c0544c99d9DBDF550659Ef32d3664Aa567] = 86007989829650589155328;
        qsdgBalances[0x63eAf0c0544c99d9DBDF550659Ef32d3664Aa567] = 1928378668619791859712;

        qsdBalances[0xA37f39c248d65f5F07A0b65550FaF63C267Fbe0d] = 7638586192661446656000;
        qsdgBalances[0xA37f39c248d65f5F07A0b65550FaF63C267Fbe0d] = 34759452857176780800;

        qsdBalances[0xD5dd2D695e921Bf0a8Da750199397c3C33b129e6] = 2620495286897260101632;
        qsdgBalances[0xD5dd2D695e921Bf0a8Da750199397c3C33b129e6] = 0;

        qsdBalances[0x4112bC8997581d448A3B37265D6Cc5D7ebc9c33C] = 22028064261124187488256;
        qsdgBalances[0x4112bC8997581d448A3B37265D6Cc5D7ebc9c33C] = 311082190912544505856;

        qsdBalances[0xD2A102b745a1f3771Cd0Ce1EE67C3C0aA594157B] = 13;
        qsdgBalances[0xD2A102b745a1f3771Cd0Ce1EE67C3C0aA594157B] = 0;

        qsdBalances[0x6c920A6736cb3f9D1999fb45d4028f4B06f00E3E] = 177046622005043265536;
        qsdgBalances[0x6c920A6736cb3f9D1999fb45d4028f4B06f00E3E] = 2622430317881352192;

        qsdBalances[0x9fdD0C914232A7433D69944853fdaa23C5ff9792] = 12004439969487898279936;
        qsdgBalances[0x9fdD0C914232A7433D69944853fdaa23C5ff9792] = 175429202487413211136;

        qsdBalances[0xBa3e737Ef7CEAFe7B586cC9Da55fe36029006EdF] = 190932820599718346752;
        qsdgBalances[0xBa3e737Ef7CEAFe7B586cC9Da55fe36029006EdF] = 3351544252865772032;

        qsdBalances[0x54a2aC5bEc44DEb48261Ba69870E0cf60E69b7CD] = 11220131715779615784960;
        qsdgBalances[0x54a2aC5bEc44DEb48261Ba69870E0cf60E69b7CD] = 134191854620980559872;

        qsdBalances[0x71e5BA181bde54aAc2244CD209517b245e210042] = 94350092094770;
        qsdgBalances[0x71e5BA181bde54aAc2244CD209517b245e210042] = 0;

        qsdBalances[0xEda17eB495F22D80F8928416Ac824Ad9CBa6ceBF] = 155169961801281241088;
        qsdgBalances[0xEda17eB495F22D80F8928416Ac824Ad9CBa6ceBF] = 3706024260184720384;

        qsdBalances[0x439c0284c1722e52BeD634cdEa59F6a399801E34] = 1;
        qsdgBalances[0x439c0284c1722e52BeD634cdEa59F6a399801E34] = 2772958557593257472;

        qsdBalances[0x2Be2273452ce4C80c0f9e9180D3f0d6eEDfa7923] = 9893323294363004960768;
        qsdgBalances[0x2Be2273452ce4C80c0f9e9180D3f0d6eEDfa7923] = 153328459095357751296;

        qsdBalances[0xB37F1C19B89b637B53508f844516371990c0072e] = 149219630567316455424;
        qsdgBalances[0xB37F1C19B89b637B53508f844516371990c0072e] = 0;

        qsdBalances[0x934AdbB72e3a8CbBd4DC0934Fd2Bd579948EAEfB] = 5;
        qsdgBalances[0x934AdbB72e3a8CbBd4DC0934Fd2Bd579948EAEfB] = 0;


    }
    
    function claim() external {
        uint256 qsd = qsdBalances[msg.sender];
        uint256 qsdg = qsdgBalances[msg.sender];

        qsdBalances[msg.sender] = 0;
        qsdgBalances[msg.sender] = 0;

        qsdToken.transfer(msg.sender, qsd);
        qsdgToken.transfer(msg.sender, qsdg);
    }
    
    
    function emergencyWithdraw(address token, uint256 value) external {
        require(msg.sender == treasury);
        
        IERC20(token).transfer(treasury, value);
    }

}