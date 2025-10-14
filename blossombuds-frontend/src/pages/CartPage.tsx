import { useCart } from "../app/CartProvider";

export default function CartPage(){
  const { items, total, remove, setQty } = useCart();
  return (
    <div className="container" style={{padding:"24px 0"}}>
      <h1>Your Cart</h1>
      {items.length===0? (
        <div className="card" style={{padding:16}}>Cart is empty.</div>
      ):(
        <>
          <div className="card" style={{padding:16,marginBottom:12}}>
            {items.map(it=>(
              <div key={it.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"center",padding:"8px 0"}}>
                <div>
                  <div style={{fontWeight:700}}>{it.name}</div>
                  {it.variant && <div style={{opacity:.7}}>{it.variant}</div>}
                </div>
                <input type="number" value={it.qty} min={1} onChange={e=>setQty(it.id, Number(e.target.value)||1)} style={{width:64}}/>
                <button className="btn secondary" onClick={()=>remove(it.id)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><b>Total:</b> ₹{total}</div>
            <button className="btn">Proceed to Checkout</button>
          </div>
        </>
      )}
    </div>
  );
}
