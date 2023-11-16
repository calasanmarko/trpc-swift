//
//  ContentView.swift
//  trpc-swift-demo
//
//  Created by Marko on 11/16/23.
//

import SwiftUI

struct ContentView: View {
    let app = AppClient(baseUrl: URL(string: "http://localhost:5050/trpc")!)
    
    var body: some View {
        VStack {
            Button {
                doQuery()
            } label: {
                Text("Test")
            }
        }
        .padding()
        .onAppear {
            doQuery()
        }
    }
    
    func doQuery() {
        Task {
            let res = try! await AppClient.Layer.Depth().igor(input: .init(name: "sdklfjsd", other: [.init(nest: 4, bro: .init(), arr: ["a"], arr2: nil)]))
            print(res)
        }
    }
}

#Preview {
    ContentView()
}
