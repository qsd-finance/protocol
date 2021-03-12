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
        
        
        qsdBalances[0x7a03b2e8ACe63164896717C1b22647aA450954A7] = 20;
        qsdgBalances[0x7a03b2e8ACe63164896717C1b22647aA450954A7] = 100;

        qsdBalances[0x045cDCC2fc44Ea185c9cA70DdFA574D202a74848] = 20;
        qsdgBalances[0x045cDCC2fc44Ea185c9cA70DdFA574D202a74848] = 100;
    }
    
    function claim() external {
        uint256 qsd = qsdBalances[msg.sender];
        qsdBalances[msg.sender] = 0;
        qsdToken.transfer(msg.sender, qsd);

        uint256 qsdg = qsdgBalances[msg.sender];
        qsdgBalances[msg.sender] = 0;
        qsdgToken.transfer(msg.sender, qsdg);
    }
    
    
    function emergencyWithdraw(address token, uint256 value) external {
        require(msg.sender == treasury);
        
        IERC20(token).transfer(treasury, value);
    }

}